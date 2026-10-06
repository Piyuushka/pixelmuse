/**
 * PathFinder Access - Spatial Lookup Engine
 *
 * Implements `getAffectedNavigatingUsers()` — the core function that
 * matches newly reported / confirmed temporary barriers against all
 * currently navigating users.
 *
 * Algorithm (two-phase, similar to PostGIS ST_DWithin + precise check):
 *
 *   Phase 1 — Coarse H3 Cell Filter (O(k) per barrier, k = cells in buffer)
 *     Compute H3 Res-8 disk around the barrier location.
 *     Intersect with inverted cell index from NavigationSessionRegistry.
 *     Produces candidate sessions that share at least one spatial cell.
 *
 *   Phase 2 — Precise Segment-Level Intersection Check (O(n) per candidate)
 *     For each candidate session:
 *       a) Confirm barrier is within the REMAINING (not already-passed) route.
 *       b) Compute exact segment perpendicular distance to barrier.
 *       c) Apply 200m minimum "distance ahead" threshold.
 *       d) Apply road layer guard (flyover ≠ service road).
 *       e) Compute estimated detour time.
 *
 *   Phase 3 — Alert Dispatch
 *     For each confirmed affected session:
 *       Deliver a NavigationAlert via the session's alertCallback.
 *       Emit a BARRIER_REPORTED / ALERT_PUSHED event via barrierBroadcaster.
 */

import {
  Coordinates,
  calculateHaversineDistance,
} from './spatial';
import {
  H3CellId,
  getH3Buffer,
  latLngToH3Cell,
  closestPointOnSegment,
  getRemainingRouteDistance,
  h3CellsIntersect,
} from './h3Indexer';
import {
  NavigationSession,
  NavigationAlert,
  sessionRegistry,
} from './navigationSessionRegistry';
import { RoadLayerType } from './db/mongoSchema';
import { barrierBroadcaster } from './realtimeEngine';

// ============================================================
// CONFIGURATION CONSTANTS
// ============================================================

/** Minimum meters barrier must be AHEAD of user to warrant an alert. */
const MIN_DISTANCE_AHEAD_METERS = 200;

/**
 * Maximum meters barrier can be from the route for a precise-match hit.
 * Applied in Phase 2 after coarse H3 filter.
 */
const MAX_SEGMENT_PROXIMITY_METERS = 150;

/**
 * Coarse H3 resolution for barrier buffer zone lookup.
 * Res 8 ≈ 461m edge — ensures we catch sessions in adjacent cells.
 */
const BARRIER_BUFFER_RESOLUTION = 8;

/**
 * Fine H3 resolution used by session route indexing.
 * Must match the resolution used in NavigationSessionRegistry.startSession().
 */
const ROUTE_CELL_RESOLUTION = 9;

/**
 * Minimum confidence score a barrier must have to trigger user alerts.
 * Prevents noise from low-quality single reports.
 */
const MIN_BARRIER_CONFIDENCE_TO_ALERT = 0.4;

/**
 * Walking / slow vehicle speed assumption for detour ETA (m/min).
 */
const NAVIGATION_SPEED_M_PER_MIN = 80;

// ============================================================
// INPUT / OUTPUT TYPES
// ============================================================

export interface BarrierLookupInput {
  barrierId: string;
  category: string;
  location: Coordinates;
  roadLayer: RoadLayerType;
  confidenceScore: number;
  radiusMeters?: number;   // buffer zone around barrier (default 300m)
}

export interface AffectedSessionResult {
  session: NavigationSession;
  distanceAheadMeters: number;
  closestSegmentIndex: number;
  closestPointOnRoute: Coordinates;
  estimatedDetourMinutes: number;
  alert: NavigationAlert;
}

export interface SpatialLookupResult {
  barrierId: string;
  barrierLocation: Coordinates;
  radiusMeters: number;
  candidatesChecked: number;
  affectedSessions: AffectedSessionResult[];
  suppressedByNoise: number;
  suppressedByLayer: number;
  suppressedByDistance: number;
  lookupDurationMs: number;
}

// ============================================================
// CORE ENGINE
// ============================================================

/**
 * Find all active navigation sessions whose route intersects with
 * the buffer zone around `barrierLocation`.
 *
 * @param input  - Barrier descriptor
 * @param registry - NavigationSessionRegistry instance (defaults to global singleton)
 */
export function getAffectedNavigatingUsers(
  input: BarrierLookupInput,
  registry = sessionRegistry
): SpatialLookupResult {
  const startMs = Date.now();
  const radius = input.radiusMeters ?? 300;

  const result: SpatialLookupResult = {
    barrierId: input.barrierId,
    barrierLocation: input.location,
    radiusMeters: radius,
    candidatesChecked: 0,
    affectedSessions: [],
    suppressedByNoise: 0,
    suppressedByLayer: 0,
    suppressedByDistance: 0,
    lookupDurationMs: 0,
  };

  // ── Noise Gate ───────────────────────────────────────────
  // Suppress lookups for low-confidence barriers (single unverified report)
  if (input.confidenceScore < MIN_BARRIER_CONFIDENCE_TO_ALERT) {
    result.suppressedByNoise = registry.activeSessionCount;
    result.lookupDurationMs = Date.now() - startMs;
    return result;
  }

  // ── Phase 1: Coarse H3 Cell Filter ───────────────────────
  // Get the H3 Res-8 disk around the barrier
  const barrierBufferCells = getH3Buffer(
    input.location,
    radius,
    BARRIER_BUFFER_RESOLUTION
  );

  // Collect unique candidate session IDs that share at least one buffer cell
  const candidateSessionIds = new Set<string>();

  for (const cell of barrierBufferCells) {
    // Upcast Res-8 cell to match Res-9 sessions via neighbor overlap
    const sessionsInCell = registry.getSessionsInCell(cell);
    for (const s of sessionsInCell) {
      candidateSessionIds.add(s.sessionId);
    }

    // Also check the Res-9 sub-cells that map to this Res-8 cell area
    const res9CellsInArea = getH3Buffer(
      input.location,
      radius,
      ROUTE_CELL_RESOLUTION
    );
    for (const fineCell of res9CellsInArea) {
      const fineSessions = registry.getSessionsInCell(fineCell);
      for (const s of fineSessions) {
        candidateSessionIds.add(s.sessionId);
      }
    }
  }

  result.candidatesChecked = candidateSessionIds.size;

  // ── Phase 2: Precise Segment-Level Intersection Check ────
  for (const sessionId of candidateSessionIds) {
    const session = registry.getSession(sessionId);
    if (!session || !session.isActive) continue;

    // ── Road Layer Guard ──────────────────────────────────
    // Flyover barrier must NOT alert users on service road and vice versa
    if (isLayerMismatch(input.roadLayer, session.roadLayer)) {
      result.suppressedByLayer++;
      continue;
    }

    // ── Remaining Route Geometry ──────────────────────────
    // Only inspect waypoints AHEAD of the user's current position
    const remainingCoords = session.routeCoords.slice(session.currentPositionIndex);
    if (remainingCoords.length < 2) continue;

    // ── Segment Walk: Find Closest Point on Remaining Route ─
    let minDistToRoute = Infinity;
    let closestSegIdx = session.currentPositionIndex;
    let closestPt: Coordinates = remainingCoords[0];

    for (let i = 0; i < remainingCoords.length - 1; i++) {
      const p1 = remainingCoords[i];
      const p2 = remainingCoords[i + 1];
      const nearest = closestPointOnSegment(input.location, p1, p2);
      const dist = calculateHaversineDistance(input.location, nearest);

      if (dist < minDistToRoute) {
        minDistToRoute = dist;
        closestSegIdx = session.currentPositionIndex + i;
        closestPt = nearest;
      }
    }

    // ── Proximity Threshold ───────────────────────────────
    if (minDistToRoute > MAX_SEGMENT_PROXIMITY_METERS) {
      result.suppressedByDistance++;
      continue;
    }

    // ── Distance Ahead Check ─────────────────────────────
    // Compute remaining distance from closest route point to destination
    const distanceAheadMeters = getRemainingRouteDistance(
      session.routeCoords,
      closestSegIdx
    );

    // Must be at least 200m AHEAD (not behind or nearly-arrived)
    if (distanceAheadMeters < MIN_DISTANCE_AHEAD_METERS) {
      result.suppressedByDistance++;
      continue;
    }

    // ── Detour Time Estimate ──────────────────────────────
    // Simple estimate: assume +20% additional distance for rerouting
    const detourDistanceM = distanceAheadMeters * 0.2;
    const estimatedDetourMinutes = Math.ceil(
      detourDistanceM / NAVIGATION_SPEED_M_PER_MIN
    );

    // ── Urgency Classification ────────────────────────────
    const urgency = classifyUrgency(distanceAheadMeters, input.confidenceScore, input.category);

    // ── Build NavigationAlert ─────────────────────────────
    const alert: NavigationAlert = {
      sessionId,
      alertId: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'BARRIER_AHEAD',
      barrier: {
        id: input.barrierId,
        category: input.category,
        location: input.location,
        distanceAheadMeters: Math.round(distanceAheadMeters),
        estimatedDetourMinutes,
      },
      message: buildAlertMessage(input.category, distanceAheadMeters, estimatedDetourMinutes),
      timestamp: Date.now(),
      urgency,
    };

    // ── Deliver Alert ─────────────────────────────────────
    registry.deliverAlert(sessionId, alert);

    // ── Broadcast via SSE/WebSocket ───────────────────────
    barrierBroadcaster.broadcast({
      type: 'ALERT_PUSHED',
      quadKey: latLngToH3Cell(input.location, BARRIER_BUFFER_RESOLUTION),
      message: alert.message,
    });

    result.affectedSessions.push({
      session,
      distanceAheadMeters,
      closestSegmentIndex: closestSegIdx,
      closestPointOnRoute: closestPt,
      estimatedDetourMinutes,
      alert,
    });
  }

  result.lookupDurationMs = Date.now() - startMs;
  return result;
}

// ============================================================
// ROAD LAYER MISMATCH GUARD
// ============================================================

/**
 * Returns true if a barrier on one layer should NOT affect users on another.
 *
 * Rules:
 *  - FLYOVER barrier → does NOT alert SERVICE_ROAD or AT_GRADE users below
 *  - SERVICE_ROAD barrier → does NOT alert FLYOVER users above
 *  - AT_GRADE barriers alert everyone on AT_GRADE (no false positives)
 */
function isLayerMismatch(
  barrierLayer: RoadLayerType,
  sessionLayer: RoadLayerType
): boolean {
  if (barrierLayer === RoadLayerType.FLYOVER && sessionLayer !== RoadLayerType.FLYOVER) {
    return true;
  }
  if (barrierLayer === RoadLayerType.SERVICE_ROAD && sessionLayer === RoadLayerType.FLYOVER) {
    return true;
  }
  return false;
}

// ============================================================
// URGENCY CLASSIFIER
// ============================================================

function classifyUrgency(
  distanceAheadMeters: number,
  confidence: number,
  category: string
): 'low' | 'medium' | 'high' | 'critical' {
  const cat = category.toUpperCase();

  // Critical: barrier is imminent and high-confidence
  if (distanceAheadMeters < 300 && confidence > 0.7) return 'critical';

  // High: critical categories regardless of distance
  if (cat.includes('FLOODING') || cat.includes('BLOCKED_RAMP')) {
    return distanceAheadMeters < 800 ? 'high' : 'medium';
  }

  // High: barricades close by
  if (cat.includes('BARRICADE') && distanceAheadMeters < 500) return 'high';

  // Medium: construction, general blockages
  if (distanceAheadMeters < 1000) return 'medium';

  return 'low';
}

// ============================================================
// ALERT MESSAGE BUILDER
// ============================================================

function buildAlertMessage(
  category: string,
  distanceAheadMeters: number,
  detourMinutes: number
): string {
  const cat = category.replace(/_/g, ' ').toLowerCase();
  const distStr =
    distanceAheadMeters >= 1000
      ? `${(distanceAheadMeters / 1000).toFixed(1)} km`
      : `${Math.round(distanceAheadMeters)} m`;

  return (
    `⚠️ ${cat.charAt(0).toUpperCase() + cat.slice(1)} reported ${distStr} ahead on your route. ` +
    `${detourMinutes > 0 ? `Estimated +${detourMinutes} min if rerouted.` : 'Minimal impact expected.'}`
  );
}

// ============================================================
// BATCH PROCESSOR: Run lookup for multiple barriers at once
// ============================================================

/**
 * Efficiently processes a batch of newly confirmed/reported barriers.
 * Deduplicates alerts per user session across all barriers in the batch.
 * Useful when the TTL cleaner broadcasts multiple BARRIER_EXPIRED events
 * or when a cluster confirmation triggers mass route recalculation.
 */
export function processBarrierBatch(
  barriers: BarrierLookupInput[],
  registry = sessionRegistry
): {
  totalAffectedSessions: number;
  results: SpatialLookupResult[];
} {
  const alreadyAlertedSessions = new Set<string>();
  const results: SpatialLookupResult[] = [];

  for (const barrier of barriers) {
    const result = getAffectedNavigatingUsers(barrier, registry);

    // Deduplicate: only alert a session once even if multiple barriers hit it
    result.affectedSessions = result.affectedSessions.filter(r => {
      if (alreadyAlertedSessions.has(r.session.sessionId)) return false;
      alreadyAlertedSessions.add(r.session.sessionId);
      return true;
    });

    results.push(result);
  }

  return {
    totalAffectedSessions: alreadyAlertedSessions.size,
    results,
  };
}

// ============================================================
// PostGIS SQL EQUIVALENT (for reference / server-side use)
// ============================================================
//
// The TypeScript engine above is the client/edge-runtime implementation.
// For a production PostgreSQL backend, the equivalent spatial query is:
//
// SELECT
//   ns.session_id,
//   ns.user_id,
//   ST_Distance(ns.current_position::geography, $1::geography) AS dist_to_barrier,
//   ST_LineLocatePoint(ns.route_geometry, ST_ClosestPoint(ns.route_geometry, $1)) AS position_fraction,
//   ST_Length(ST_LineSubstring(
//     ns.route_geometry,
//     ST_LineLocatePoint(ns.route_geometry, ST_ClosestPoint(ns.route_geometry, $1)),
//     1.0
//   )::geography) AS remaining_dist_m
// FROM navigation_sessions ns
// WHERE
//   ns.is_active = TRUE
//   AND ns.road_layer = $2                        -- layer guard
//   AND ST_DWithin(ns.route_geometry::geography, $1::geography, $3)  -- radius filter
//   AND ST_Length(ST_LineSubstring(               -- min 200m ahead
//     ns.route_geometry,
//     ST_LineLocatePoint(ns.route_geometry, ST_ClosestPoint(ns.route_geometry, $1)),
//     1.0
//   )::geography) >= 200
// ORDER BY remaining_dist_m ASC;
//
// Parameters: $1 = barrier POINT geometry, $2 = road_layer, $3 = radius in meters
