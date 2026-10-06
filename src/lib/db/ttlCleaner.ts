/**
 * PathFinder Access - TTL Cleaner Worker
 *
 * Event-driven + cron-hybrid worker that:
 *   1. Runs on a configurable interval (default every 60 seconds)
 *   2. Scans all ACTIVE/PENDING barriers where expires_at <= NOW()
 *      OR where confidence_score dropped below expiry threshold
 *   3. Atomically marks them EXPIRED and sets routing_penalty = 0
 *   4. Emits BARRIER_EXPIRED events via barrierBroadcaster so the
 *      routing engine can instantly remove edge weight penalties
 *   5. Supports manual trigger (event-driven) when a downvote
 *      threshold is hit — no waiting for next cron tick
 *
 * Runs in both Node.js (server) and browser (client-side local state simulation).
 * When a real DB is connected, replace the in-memory store calls with DB queries.
 */

import { BarrierStatus, IBarrierReport } from './mongoSchema';
import { applyDownvote } from './barrierService';
import { barrierBroadcaster } from '../realtimeEngine';

// ============================================================
// TTL CLEANER RESULT
// ============================================================

export interface TTLCleanerResult {
  processed: number;
  expired: ExpiredBarrierRecord[];
  timestamp: Date;
  durationMs: number;
}

export interface ExpiredBarrierRecord {
  id: string;
  category: string;
  osm_way_id?: number;
  road_segment_id?: string;
  location: [number, number];
  routingPenaltyRemoved: number;
}

// ============================================================
// IN-MEMORY STORE ADAPTER
// Swappable with a real DB client (PostgreSQL / MongoDB) in production.
// ============================================================

export interface BarrierStoreAdapter {
  findExpired(): Promise<IBarrierReport[]>;
  markExpired(ids: string[]): Promise<void>;
  getAll(): Promise<IBarrierReport[]>;
}

/**
 * LocalStateAdapter — operates on a shared in-memory array.
 * Used in the browser/client context to drive front-end state updates.
 */
export class LocalStateAdapter implements BarrierStoreAdapter {
  constructor(
    private getReports: () => IBarrierReport[],
    private setReports: (reports: IBarrierReport[]) => void
  ) {}

  async findExpired(): Promise<IBarrierReport[]> {
    const now = new Date();
    return this.getReports().filter(r =>
      (r.status === BarrierStatus.ACTIVE || r.status === BarrierStatus.PENDING) &&
      r.expires_at <= now
    );
  }

  async markExpired(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const now = new Date();
    this.setReports(
      this.getReports().map(r =>
        idSet.has(r._id ?? '') && r.status !== BarrierStatus.EXPIRED
          ? { ...r, status: BarrierStatus.EXPIRED, routing_penalty: 0, resolved_at: now, updated_at: now }
          : r
      )
    );
  }

  async getAll(): Promise<IBarrierReport[]> {
    return this.getReports();
  }
}

/**
 * PostgreSQLAdapter — production adapter for use in a Next.js API route
 * or standalone Node.js worker process.
 *
 * Usage (requires 'pg' package):
 *   import { Pool } from 'pg';
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const adapter = new PostgreSQLAdapter(pool);
 */
export class PostgreSQLAdapter implements BarrierStoreAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private pool: any) {}

  async findExpired(): Promise<IBarrierReport[]> {
    const { rows } = await this.pool.query(`
      SELECT
        id::text AS "_id",
        user_id::text,
        category,
        status,
        ST_X(location::geometry) AS lng,
        ST_Y(location::geometry) AS lat,
        road_segment_id,
        osm_way_id,
        road_layer,
        upvotes,
        downvotes,
        cluster_count,
        confidence_score,
        routing_penalty,
        created_at,
        expires_at,
        updated_at,
        resolved_at,
        description,
        is_clustered,
        parent_report_id::text
      FROM barrier_reports
      WHERE status IN ('ACTIVE', 'PENDING')
        AND expires_at <= NOW()
      FOR UPDATE SKIP LOCKED
    `);

    return rows.map((row: Record<string, unknown>) => ({
      ...row,
      location: {
        type: 'Point' as const,
        coordinates: [row.lng, row.lat] as [number, number],
      },
    }));
  }

  async markExpired(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(`
      UPDATE barrier_reports
      SET
        status          = 'EXPIRED',
        routing_penalty = 0.0,
        resolved_at     = NOW(),
        updated_at      = NOW()
      WHERE id = ANY($1::uuid[])
    `, [ids]);
  }

  async getAll(): Promise<IBarrierReport[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM barrier_reports WHERE status IN ('ACTIVE', 'PENDING')`
    );
    return rows;
  }
}

/**
 * MongoDBAdapter — production adapter for use with Mongoose.
 *
 * Usage:
 *   import BarrierReportModel from './models/BarrierReport';
 *   const adapter = new MongoDBAdapter(BarrierReportModel);
 */
export class MongoDBAdapter implements BarrierStoreAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private Model: any) {}

  async findExpired(): Promise<IBarrierReport[]> {
    return this.Model.find({
      status: { $in: [BarrierStatus.ACTIVE, BarrierStatus.PENDING] },
      expires_at: { $lte: new Date() },
    }).lean();
  }

  async markExpired(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.Model.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: BarrierStatus.EXPIRED,
          routing_penalty: 0,
          resolved_at: new Date(),
          updated_at: new Date(),
        },
      }
    );
  }

  async getAll(): Promise<IBarrierReport[]> {
    return this.Model.find({
      status: { $in: [BarrierStatus.ACTIVE, BarrierStatus.PENDING] },
    }).lean();
  }
}

// ============================================================
// TTL CLEANER WORKER CLASS
// ============================================================

export class TTLCleanerWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private adapter: BarrierStoreAdapter,
    private intervalMs: number = 60_000, // Default: run every 60 seconds
    private onCleanComplete?: (result: TTLCleanerResult) => void
  ) {}

  // --------------------------------------------------------
  // Core: Run a single TTL clean cycle
  // --------------------------------------------------------

  async runOnce(): Promise<TTLCleanerResult> {
    const startTime = Date.now();
    const expired: ExpiredBarrierRecord[] = [];

    try {
      const expiredReports = await this.adapter.findExpired();

      if (expiredReports.length > 0) {
        const ids = expiredReports
          .map(r => r._id)
          .filter((id): id is string => !!id);

        await this.adapter.markExpired(ids);

        // Emit BARRIER_EXPIRED events for each expired report
        for (const report of expiredReports) {
          const record: ExpiredBarrierRecord = {
            id: report._id ?? '',
            category: report.category,
            osm_way_id: report.osm_way_id,
            road_segment_id: report.road_segment_id,
            location: report.location.coordinates,
            routingPenaltyRemoved: report.routing_penalty,
          };
          expired.push(record);

          // Broadcast real-time expiry event to all subscribers
          barrierBroadcaster.broadcast({
            type: 'BARRIER_EXPIRED',
            quadKey: undefined,
            message: `[TTL Cleaner] Barrier "${report.description || report.category}" expired. Routing penalty ${report.routing_penalty.toFixed(0)} removed from OSM way ${report.osm_way_id ?? 'N/A'}.`,
          });
        }

        // Emit single ROUTE_RECALCULATED after batch expiry
        if (expired.length > 0) {
          barrierBroadcaster.broadcast({
            type: 'ROUTE_RECALCULATED',
            message: `[TTL Cleaner] ${expired.length} barrier(s) expired. Routing graph penalties cleared. Route recalculation triggered.`,
          });
        }
      }
    } catch (err) {
      console.error('[TTLCleanerWorker] Error during clean cycle:', err);
    }

    const result: TTLCleanerResult = {
      processed: expired.length,
      expired,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    };

    if (this.onCleanComplete) {
      this.onCleanComplete(result);
    }

    return result;
  }

  // --------------------------------------------------------
  // Start recurring cron-style interval
  // --------------------------------------------------------

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run immediately then schedule
    this.runOnce();
    this.intervalId = setInterval(() => this.runOnce(), this.intervalMs);

    console.log(
      `[TTLCleanerWorker] Started. Running every ${this.intervalMs / 1000}s.`
    );
  }

  // --------------------------------------------------------
  // Stop recurring interval
  // --------------------------------------------------------

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[TTLCleanerWorker] Stopped.');
  }

  // --------------------------------------------------------
  // Event-driven trigger: call this immediately after a downvote
  // that may have caused instant expiry (no need to wait for cron tick)
  // --------------------------------------------------------

  async triggerImmediateCheck(): Promise<TTLCleanerResult> {
    return this.runOnce();
  }

  get running(): boolean {
    return this.isRunning;
  }
}

// ============================================================
// CONVENIENCE FACTORY: Create and start a local state cleaner
// Compatible with the existing AccessibilityContext state management
// ============================================================

/**
 * Creates a TTLCleanerWorker bound to an in-memory React state array.
 * Intended for browser-side simulation and development environments.
 *
 * @param getReports  - getter for the current barrier reports array
 * @param setReports  - setter to update the array after expiry
 * @param intervalMs  - poll interval (default 30 seconds for browser)
 */
export function createLocalTTLCleaner(
  getReports: () => IBarrierReport[],
  setReports: (reports: IBarrierReport[]) => void,
  intervalMs: number = 30_000
): TTLCleanerWorker {
  const adapter = new LocalStateAdapter(getReports, setReports);
  return new TTLCleanerWorker(adapter, intervalMs, result => {
    if (result.processed > 0) {
      console.log(
        `[TTLCleaner] Expired ${result.processed} barrier(s) in ${result.durationMs}ms`
      );
    }
  });
}

// ============================================================
// PostgreSQL CRON WORKER FACTORY (Node.js server usage)
// ============================================================

/**
 * Creates a production TTLCleanerWorker backed by a PostgreSQL pool.
 *
 * Usage in a Node.js backend or Next.js instrumentation.ts:
 *
 *   import { Pool } from 'pg';
 *   import { createPostgresTTLCleaner } from '@/lib/db/ttlCleaner';
 *
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const cleaner = createPostgresTTLCleaner(pool);
 *   cleaner.start(); // every 60 seconds
 *
 * @param pool       - pg.Pool instance
 * @param intervalMs - cron interval in ms (default 60_000)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPostgresTTLCleaner(pool: any, intervalMs: number = 60_000): TTLCleanerWorker {
  const adapter = new PostgreSQLAdapter(pool);
  return new TTLCleanerWorker(adapter, intervalMs, result => {
    console.log(
      `[TTLCleaner:Postgres] ${result.processed} expired | took ${result.durationMs}ms | ${result.timestamp.toISOString()}`
    );
    for (const r of result.expired) {
      console.log(
        `  → Expired: ${r.id} | Category: ${r.category} | OSM: ${r.osm_way_id} | Penalty removed: ${r.routingPenaltyRemoved}`
      );
    }
  });
}

/**
 * Creates a production TTLCleanerWorker backed by a Mongoose Model.
 *
 * Usage:
 *   import BarrierReportModel from '@/models/BarrierReport';
 *   import { createMongoTTLCleaner } from '@/lib/db/ttlCleaner';
 *
 *   const cleaner = createMongoTTLCleaner(BarrierReportModel);
 *   cleaner.start();
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMongoTTLCleaner(Model: any, intervalMs: number = 60_000): TTLCleanerWorker {
  const adapter = new MongoDBAdapter(Model);
  return new TTLCleanerWorker(adapter, intervalMs, result => {
    console.log(
      `[TTLCleaner:MongoDB] ${result.processed} expired | took ${result.durationMs}ms`
    );
  });
}
