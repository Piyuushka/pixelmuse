/**
 * PathFinder Access - Barrier Service Layer
 *
 * Implements persistent barrier management with:
 * 1. Supabase integration with automatic in-memory fallback in demo mode.
 * 2. Categories:
 *    - stairs
 *    - broken_footpath
 *    - steep_road
 *    - blocked_ramp
 *    - inaccessible_entrance
 *    - poor_lighting
 *    - temporary_obstacle (with rapid TTL expiry)
 *    - elevator_outage
 * 3. Status Lifecycle:
 *    - UNVERIFIED -> COMMUNITY_VERIFIED (3+ net confirmations) -> RESOLVED
 *    - DISPUTED (when disputes outnumber confirmations or heavy downvotes)
 *    - EXPIRED (when temporary obstacle TTL passes)
 * 4. Automatic session rerouting: status changes trigger triggerActiveBarrierRecalculation.
 * 5. Report timeline: anonymized action history (who/when/what).
 * 6. 20-meter spatial clustering (merges duplicates, extends TTL, avoids map clutter).
 * 7. One-vote-per-user-per-report and sliding-window rate limiting.
 */

import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase';
import { triggerActiveBarrierRecalculation } from '../routeRecalculator';
import { barrierBroadcaster } from '../realtimeEngine';

// ============================================================
// 1. DOMAIN TYPES & ENUMS
// ============================================================

export type BarrierCategory =
  | 'stairs'
  | 'broken_footpath'
  | 'steep_road'
  | 'blocked_ramp'
  | 'inaccessible_entrance'
  | 'poor_lighting'
  | 'temporary_obstacle'
  | 'elevator_outage';

export type BarrierStatus =
  | 'UNVERIFIED'
  | 'COMMUNITY_VERIFIED'
  | 'RESOLVED'
  | 'DISPUTED'
  | 'EXPIRED';

export type BarrierSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BarrierTimelineEvent {
  id: string;
  action: 'REPORTED' | 'CONFIRMED' | 'DISPUTED' | 'FIXED' | 'STATUS_CHANGED' | 'EXPIRED';
  actor: string; // Anonymized, e.g. "Navigator #401", "Citizen #82"
  timestamp: string; // ISO date string
  details?: string;
}

export interface BarrierRecord {
  id: string;
  user_id: string;
  title: string;
  category: BarrierCategory;
  status: BarrierStatus;
  location_name: string;
  lat: number;
  lng: number;
  micro_location?: string;
  description?: string;
  photo_url?: string;
  severity: BarrierSeverity;
  estimated_resolution_time?: string;
  confirmations: number;
  disputes: number;
  fixed_reports: number;
  cluster_count: number;
  confidence_score: number; // 0.0 - 1.0
  routing_penalty: number;
  created_at: string; // ISO string
  updated_at: string;
  expires_at: string;
  resolved_at?: string;
  timeline: BarrierTimelineEvent[];
}

export interface CreateBarrierInput {
  user_id?: string;
  title: string;
  category: BarrierCategory;
  lat: number;
  lng: number;
  location_name?: string;
  micro_location?: string;
  description?: string;
  photo_url?: string;
  severity?: BarrierSeverity;
  estimated_resolution_time?: string;
}

export interface VoteBarrierInput {
  barrier_id: string;
  action: 'confirm' | 'dispute' | 'fixed';
  user_id?: string;
  ip_address?: string;
}

// ============================================================
// 2. CATEGORY CONFIGURATIONS: TTL & BASE PENALTIES
// ============================================================

export const CATEGORY_LABELS: Record<BarrierCategory, string> = {
  stairs: 'Stairs / Steep Flight of Steps',
  broken_footpath: 'Broken Footpath / Uneven Pavers',
  steep_road: 'Steep Road / High Incline',
  blocked_ramp: 'Blocked / Missing Ramp',
  inaccessible_entrance: 'Inaccessible Entrance / Heavy Door',
  poor_lighting: 'Poor Street Lighting',
  temporary_obstacle: 'Temporary Obstacle (Roadworks / Puddle)',
  elevator_outage: 'Elevator / Escalator Out of Service',
};

export const CATEGORY_TTL_MINUTES: Record<BarrierCategory, number> = {
  temporary_obstacle: 180,    // 3 hours (rapid weather/roadwork decay)
  elevator_outage: 720,        // 12 hours
  poor_lighting: 1440,         // 24 hours
  blocked_ramp: 240,           // 4 hours
  broken_footpath: 43200,      // 30 days
  stairs: 43200,               // 30 days
  steep_road: 43200,           // 30 days
  inaccessible_entrance: 43200,// 30 days
};

export const CATEGORY_BASE_PENALTIES: Record<BarrierCategory, number> = {
  stairs: 15000,               // Infinite/impassable for wheelchair
  inaccessible_entrance: 12000,
  blocked_ramp: 10000,
  elevator_outage: 9000,
  broken_footpath: 6000,
  steep_road: 7000,
  temporary_obstacle: 8000,
  poor_lighting: 3000,
};

// ============================================================
// 3. ANONYMIZATION & TIMELINE HELPERS
// ============================================================

export function anonymizeActor(userId?: string): string {
  if (!userId || userId === 'anonymous' || userId.startsWith('anon-')) {
    const hash = Math.floor(Math.random() * 899 + 100);
    return `Navigator #${hash}`;
  }
  // Deterministic 3-digit hash from userId
  let sum = 0;
  for (let i = 0; i < userId.length; i++) {
    sum = (sum * 31 + userId.charCodeAt(i)) % 900;
  }
  return `Citizen #${sum + 100}`;
}

export function computeExpiresAt(category: BarrierCategory, fromDate: Date = new Date()): Date {
  const ttlMin = CATEGORY_TTL_MINUTES[category] ?? 180;
  return new Date(fromDate.getTime() + ttlMin * 60 * 1000);
}

export function computeConfidenceScore(confirmations: number, disputes: number): number {
  if (confirmations + disputes === 0) return 0.5; // neutral baseline
  const raw = (confirmations - disputes * 1.5) / (confirmations + disputes + 1);
  const normalized = (raw + 1.0) / 2.0;
  return Math.max(0.0, Math.min(1.0, Number(normalized.toFixed(2))));
}

export function computeRoutingPenalty(category: BarrierCategory, confidence: number): number {
  const base = CATEGORY_BASE_PENALTIES[category] ?? 5000;
  return Math.round(base * Math.max(0.1, confidence));
}

// ============================================================
// 4. HAVERSINE 20-METER CLUSTERING LOGIC
// ============================================================

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// 5. IN-MEMORY STORE (DEMO MODE & FALLBACK)
// ============================================================

const initialTimestamp = new Date(Date.now() - 3600000 * 2).toISOString();

export const SEEDED_BARRIERS: BarrierRecord[] = [
  {
    id: 'bar-dadar-ramp',
    user_id: 'user-system-1',
    title: 'Blocked Concourse Ramp at Platform 4',
    category: 'blocked_ramp',
    status: 'COMMUNITY_VERIFIED',
    location_name: 'Dadar Central Station - Concourse Overbridge',
    lat: 19.0182,
    lng: 72.8435,
    micro_location: 'Near Gate 2 Staircase',
    description: 'Baggage carts and construction scaffolding blocking wheelchair ramp access.',
    severity: 'critical',
    estimated_resolution_time: 'Est. 2h 0m',
    confirmations: 6,
    disputes: 0,
    fixed_reports: 0,
    cluster_count: 2,
    confidence_score: 0.92,
    routing_penalty: 9200,
    created_at: initialTimestamp,
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 4).toISOString(),
    timeline: [
      {
        id: 'evt-1',
        action: 'REPORTED',
        actor: 'Navigator #214',
        timestamp: initialTimestamp,
        details: 'Initial report filed with photo evidence.',
      },
      {
        id: 'evt-2',
        action: 'CONFIRMED',
        actor: 'Citizen #518',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: 'Confirmed still present (+30 min TTL extension).',
      },
      {
        id: 'evt-3',
        action: 'STATUS_CHANGED',
        actor: 'System Consensus',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: 'Promoted to COMMUNITY_VERIFIED (3+ net confirmations).',
      },
    ],
  },
  {
    id: 'bar-bandra-lift',
    user_id: 'user-system-2',
    title: 'Elevator Out of Service at West Exit',
    category: 'elevator_outage',
    status: 'COMMUNITY_VERIFIED',
    location_name: 'Bandra Station West - Skywalk Connector',
    lat: 19.0558,
    lng: 72.8402,
    micro_location: 'Skywalk Level 1',
    description: 'Lift display shows Error 404. Technicians not on site.',
    severity: 'high',
    estimated_resolution_time: 'Est. 4h 0m',
    confirmations: 4,
    disputes: 1,
    fixed_reports: 0,
    cluster_count: 1,
    confidence_score: 0.78,
    routing_penalty: 7020,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 900000).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 8).toISOString(),
    timeline: [
      {
        id: 'evt-b1',
        action: 'REPORTED',
        actor: 'Navigator #412',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        details: 'Elevator out of service reported.',
      },
      {
        id: 'evt-b2',
        action: 'CONFIRMED',
        actor: 'Citizen #109',
        timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        details: 'Confirmed out of order.',
      },
      {
        id: 'evt-b3',
        action: 'STATUS_CHANGED',
        actor: 'System Consensus',
        timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        details: 'Promoted to COMMUNITY_VERIFIED (3+ net confirmations).',
      },
    ],
  },
  {
    id: 'bar-juhu-waterlog',
    user_id: 'user-system-3',
    title: 'Monsoon Waterlogging & Submerged Dropped Curb',
    category: 'temporary_obstacle',
    status: 'UNVERIFIED',
    location_name: 'Juhu Beach Promenade Crossing',
    lat: 19.0988,
    lng: 72.8264,
    micro_location: 'Near Beach Concourse Gate 1',
    description: 'Water depth ~15cm covering curb cut. Power wheelchairs cannot pass.',
    severity: 'high',
    estimated_resolution_time: 'Est. 1h 30m',
    confirmations: 1,
    disputes: 0,
    fixed_reports: 0,
    cluster_count: 1,
    confidence_score: 0.60,
    routing_penalty: 4800,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 2.5).toISOString(),
    timeline: [
      {
        id: 'evt-j1',
        action: 'REPORTED',
        actor: 'Navigator #709',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        details: 'Filed with depth estimate.',
      },
    ],
  },
];

// Global in-memory storage maps for Node server lifecycle
const memoryStore = new Map<string, BarrierRecord>();
SEEDED_BARRIERS.forEach((b) => memoryStore.set(b.id, { ...b }));

// Set of voted keys: "barrierId:userId" or "barrierId:ip"
const votedTracker = new Set<string>();

// Rate limit tracker: "ipOrUserId" -> { count, resetAt }
const rateLimitTracker = new Map<string, { count: number; resetAt: number }>();

// ============================================================
// 6. RATE LIMITING & ONE-VOTE ENFORCEMENT
// ============================================================

export function checkRateLimit(key: string, maxRequests: number = 20, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitTracker.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitTracker.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false; // Rate limit exceeded
  }
  entry.count++;
  return true;
}

export function hasUserVoted(barrierId: string, userIdOrIp: string): boolean {
  return votedTracker.has(`${barrierId}:${userIdOrIp}`);
}

export function recordUserVote(barrierId: string, userIdOrIp: string): void {
  votedTracker.add(`${barrierId}:${userIdOrIp}`);
}

// ============================================================
// 7. CORE BARRIER SERVICE APIS
// ============================================================

export interface GetBarriersFilter {
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  category?: BarrierCategory;
  status?: BarrierStatus;
  includeExpired?: boolean;
}

/**
 * Retrieves barriers matching filter criteria with automatic TTL expiration.
 */
export async function getBarriers(filter: GetBarriersFilter = {}): Promise<BarrierRecord[]> {
  const now = new Date();

  // If Supabase is configured and not forced to demo mode
  if (isSupabaseConfigured() && process.env.DEMO_MODE !== 'true') {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        let query = supabase.from('barrier_reports').select('*');

        if (filter.category) query = query.eq('category', filter.category);
        if (filter.status) query = query.eq('status', filter.status);
        if (!filter.includeExpired) query = query.neq('status', 'EXPIRED');

        if (filter.bbox) {
          const [minLng, minLat, maxLng, maxLat] = filter.bbox;
          // PostGIS or bounding box check
          query = query
            .gte('lng', minLng)
            .lte('lng', maxLng)
            .gte('lat', minLat)
            .lte('lat', maxLat);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data) {
          return data as BarrierRecord[];
        }
      }
    } catch (err) {
      console.warn('[BarrierService] Supabase query failed, falling back to in-memory store:', err);
    }
  }

  // In-memory fallback
  const results: BarrierRecord[] = [];

  for (const barrier of memoryStore.values()) {
    // 1. Auto-expire temporary obstacles whose TTL has elapsed
    if (
      barrier.status !== 'RESOLVED' &&
      barrier.status !== 'EXPIRED' &&
      new Date(barrier.expires_at) <= now
    ) {
      barrier.status = 'EXPIRED';
      barrier.routing_penalty = 0;
      barrier.timeline.push({
        id: `evt-exp-${Date.now()}`,
        action: 'EXPIRED',
        actor: 'TTL Cleaner Service',
        timestamp: now.toISOString(),
        details: 'Temporary hazard TTL expired naturally without re-confirmation.',
      });
      // Broadcast expiry
      barrierBroadcaster.broadcast({
        type: 'BARRIER_EXPIRED',
        barrier: {
          id: barrier.id,
          title: barrier.title,
          category: barrier.category,
          severity: barrier.severity,
          location: barrier.location_name,
          status: 'Reported',
          votes: barrier.confirmations,
          date: 'Expired',
          createdAt: new Date(barrier.created_at).getTime(),
          ttlSeconds: 0,
          description: barrier.description || '',
          coordinates: { lat: barrier.lat, lng: barrier.lng },
          roadLayer: 'at_grade',
          quadKey: '',
          clusterCount: barrier.cluster_count,
        },
        message: `Barrier "${barrier.title}" has expired and was cleared from routing.`,
      });
    }

    // Filter checks
    if (!filter.includeExpired && barrier.status === 'EXPIRED') continue;
    if (filter.status && barrier.status !== filter.status) continue;
    if (filter.category && barrier.category !== filter.category) continue;

    // Bounding Box filter
    if (filter.bbox) {
      const [minLng, minLat, maxLng, maxLat] = filter.bbox;
      if (
        barrier.lng < minLng ||
        barrier.lng > maxLng ||
        barrier.lat < minLat ||
        barrier.lat > maxLat
      ) {
        continue;
      }
    }

    results.push(barrier);
  }

  // Sort by newest created first
  return results.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Retrieves a single barrier by ID.
 */
export async function getBarrierById(id: string): Promise<BarrierRecord | null> {
  if (isSupabaseConfigured() && process.env.DEMO_MODE !== 'true') {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data } = await supabase.from('barrier_reports').select('*').eq('id', id).single();
        if (data) return data as BarrierRecord;
      }
    } catch (err) {
      console.warn('[BarrierService] Supabase getBarrierById failed, checking in-memory store:', err);
    }
  }

  return memoryStore.get(id) || null;
}

/**
 * Creates a new barrier or merges into an existing 20-meter cluster.
 */
export async function createBarrier(input: CreateBarrierInput): Promise<{
  barrier: BarrierRecord;
  isClustered: boolean;
  rerouteNotice?: string;
}> {
  const now = new Date();
  const userId = input.user_id || `anon-${Date.now()}`;
  const actor = anonymizeActor(userId);

  // 1. Check for 20-meter spatial cluster among active/unverified barriers
  let clusterMatch: BarrierRecord | null = null;
  for (const existing of memoryStore.values()) {
    if (existing.status === 'RESOLVED' || existing.status === 'EXPIRED') continue;

    const dist = haversineDistanceMeters(input.lat, input.lng, existing.lat, existing.lng);
    if (dist <= 20) {
      // Proximity match within 20 meters!
      clusterMatch = existing;
      break;
    }
  }

  if (clusterMatch) {
    // Merge into cluster: increment confirmations, cluster count, extend TTL +30 mins
    clusterMatch.confirmations++;
    clusterMatch.cluster_count++;
    clusterMatch.updated_at = now.toISOString();

    const currentExpires = new Date(clusterMatch.expires_at);
    clusterMatch.expires_at = new Date(currentExpires.getTime() + 30 * 60 * 1000).toISOString();
    clusterMatch.confidence_score = computeConfidenceScore(
      clusterMatch.confirmations,
      clusterMatch.disputes
    );
    clusterMatch.routing_penalty = computeRoutingPenalty(
      clusterMatch.category,
      clusterMatch.confidence_score
    );

    // Status transition check: 3+ net confirmations -> COMMUNITY_VERIFIED
    let statusChanged = false;
    if (
      clusterMatch.status === 'UNVERIFIED' &&
      clusterMatch.confirmations - clusterMatch.disputes >= 3
    ) {
      clusterMatch.status = 'COMMUNITY_VERIFIED';
      statusChanged = true;
    }

    clusterMatch.timeline.push({
      id: `evt-cluster-${Date.now()}`,
      action: 'CONFIRMED',
      actor,
      timestamp: now.toISOString(),
      details: `Re-reported within 20m cluster. Confirmed status & extended TTL +30 min.`,
    });

    if (statusChanged) {
      clusterMatch.timeline.push({
        id: `evt-stat-${Date.now()}`,
        action: 'STATUS_CHANGED',
        actor: 'Consensus Engine',
        timestamp: now.toISOString(),
        details: 'Promoted to COMMUNITY_VERIFIED (3+ net confirmations achieved).',
      });
      // Call async rerouting engine
      await triggerActiveBarrierRecalculation({
        id: clusterMatch.id,
        title: clusterMatch.title,
        category: clusterMatch.category,
        severity: clusterMatch.severity,
        location: clusterMatch.location_name,
        status: 'Verified',
        votes: clusterMatch.confirmations,
        date: 'Just now',
        createdAt: new Date(clusterMatch.created_at).getTime(),
        ttlSeconds: 7200,
        description: clusterMatch.description || '',
        coordinates: { lat: clusterMatch.lat, lng: clusterMatch.lng },
        roadLayer: 'at_grade',
        quadKey: '',
        clusterCount: clusterMatch.cluster_count,
      });
    }

    recordUserVote(clusterMatch.id, userId);

    return {
      barrier: clusterMatch,
      isClustered: true,
      rerouteNotice: `Existing barrier within 20 meters merged. Total confirmations: ${clusterMatch.confirmations}.`,
    };
  }

  // 2. Create brand-new BarrierRecord
  const id = `bar-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const expiresAt = computeExpiresAt(input.category, now).toISOString();
  const initialConfidence = 0.5;
  const initialPenalty = computeRoutingPenalty(input.category, initialConfidence);

  const newBarrier: BarrierRecord = {
    id,
    user_id: userId,
    title: input.title.trim(),
    category: input.category,
    status: 'UNVERIFIED',
    location_name: input.location_name || `${input.lat.toFixed(4)}° N, ${input.lng.toFixed(4)}° E`,
    lat: input.lat,
    lng: input.lng,
    micro_location: input.micro_location,
    description: input.description,
    photo_url: input.photo_url,
    severity: input.severity || 'high',
    estimated_resolution_time: input.estimated_resolution_time || 'Est. 2h 0m',
    confirmations: 1,
    disputes: 0,
    fixed_reports: 0,
    cluster_count: 1,
    confidence_score: initialConfidence,
    routing_penalty: initialPenalty,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    expires_at: expiresAt,
    timeline: [
      {
        id: `evt-rep-${Date.now()}`,
        action: 'REPORTED',
        actor,
        timestamp: now.toISOString(),
        details: 'Initial report submitted via Community Navigation interface.',
      },
    ],
  };

  // Persist to memory store
  memoryStore.set(id, newBarrier);
  recordUserVote(id, userId);

  // If Supabase configured, attempt insert
  if (isSupabaseConfigured() && process.env.DEMO_MODE !== 'true') {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase.from('barrier_reports').insert({
          id: newBarrier.id,
          user_id: newBarrier.user_id,
          title: newBarrier.title,
          category: newBarrier.category,
          status: newBarrier.status,
          location_name: newBarrier.location_name,
          lat: newBarrier.lat,
          lng: newBarrier.lng,
          description: newBarrier.description,
          photo_url: newBarrier.photo_url,
          severity: newBarrier.severity,
          confirmations: newBarrier.confirmations,
          disputes: newBarrier.disputes,
          cluster_count: newBarrier.cluster_count,
          confidence_score: newBarrier.confidence_score,
          routing_penalty: newBarrier.routing_penalty,
          created_at: newBarrier.created_at,
          expires_at: newBarrier.expires_at,
          timeline: newBarrier.timeline,
        });
      }
    } catch (err) {
      console.warn('[BarrierService] Supabase insert failed, stored in memory:', err);
    }
  }

  // Trigger recalculator if critical severity
  if (newBarrier.severity === 'critical') {
    await triggerActiveBarrierRecalculation({
      id: newBarrier.id,
      title: newBarrier.title,
      category: newBarrier.category,
      severity: newBarrier.severity,
      location: newBarrier.location_name,
      status: 'Reported',
      votes: newBarrier.confirmations,
      date: 'Just now',
      createdAt: now.getTime(),
      ttlSeconds: 7200,
      description: newBarrier.description || '',
      coordinates: { lat: newBarrier.lat, lng: newBarrier.lng },
      roadLayer: 'at_grade',
      quadKey: '',
      clusterCount: 1,
    });
  }

  // Broadcast event
  barrierBroadcaster.broadcast({
    type: 'BARRIER_REPORTED',
    barrier: {
      id: newBarrier.id,
      title: newBarrier.title,
      category: newBarrier.category,
      severity: newBarrier.severity,
      location: newBarrier.location_name,
      status: 'Reported',
      votes: 1,
      date: 'Just now',
      createdAt: now.getTime(),
      ttlSeconds: 7200,
      description: newBarrier.description || '',
      coordinates: { lat: newBarrier.lat, lng: newBarrier.lng },
      roadLayer: 'at_grade',
      quadKey: '',
      clusterCount: 1,
    },
    message: `New barrier reported: "${newBarrier.title}".`,
  });

  return {
    barrier: newBarrier,
    isClustered: false,
    rerouteNotice: 'New barrier registered and broadcast to active community navigators.',
  };
}

/**
 * Applies a vote (confirm | dispute | fixed) with one-vote enforcement,
 * status state transitions, and rerouting triggers.
 */
export async function voteBarrier(input: VoteBarrierInput): Promise<{
  barrier: BarrierRecord;
  statusChanged: boolean;
  previousStatus: BarrierStatus;
  newStatus: BarrierStatus;
}> {
  const barrier = await getBarrierById(input.barrier_id);
  if (!barrier) {
    throw new Error('Barrier not found');
  }

  const userId = input.user_id || input.ip_address || 'anonymous';

  // 1. Enforce one vote per user per report
  if (hasUserVoted(barrier.id, userId)) {
    throw new Error('User has already voted on this barrier report');
  }

  const now = new Date();
  const actor = anonymizeActor(userId);
  const previousStatus = barrier.status;

  // 2. Apply vote logic
  if (input.action === 'confirm') {
    barrier.confirmations++;
    const currentExp = new Date(barrier.expires_at);
    barrier.expires_at = new Date(currentExp.getTime() + 30 * 60 * 1000).toISOString(); // +30 mins TTL
    barrier.timeline.push({
      id: `evt-vote-${Date.now()}`,
      action: 'CONFIRMED',
      actor,
      timestamp: now.toISOString(),
      details: 'Confirmed still present (+30 min TTL extension).',
    });
  } else if (input.action === 'dispute') {
    barrier.disputes++;
    const currentExp = new Date(barrier.expires_at);
    const reduced = new Date(currentExp.getTime() - 45 * 60 * 1000); // -45 mins TTL
    const minFloor = new Date(now.getTime() + 5 * 60 * 1000);
    barrier.expires_at = (reduced < minFloor ? minFloor : reduced).toISOString();
    barrier.timeline.push({
      id: `evt-dispute-${Date.now()}`,
      action: 'DISPUTED',
      actor,
      timestamp: now.toISOString(),
      details: 'Reported as inaccurate or barrier not observed (-45 min TTL).',
    });
  } else if (input.action === 'fixed') {
    barrier.fixed_reports++;
    barrier.timeline.push({
      id: `evt-fixed-${Date.now()}`,
      action: 'FIXED',
      actor,
      timestamp: now.toISOString(),
      details: 'Reported as repaired, cleared, or removed by municipality/community.',
    });
  }

  // 3. Recalculate confidence score and routing penalty
  barrier.confidence_score = computeConfidenceScore(barrier.confirmations, barrier.disputes);
  barrier.routing_penalty = computeRoutingPenalty(barrier.category, barrier.confidence_score);
  barrier.updated_at = now.toISOString();

  // 4. Status State Machine Transition Check
  let newStatus: BarrierStatus = barrier.status;
  const netConfirmations = barrier.confirmations - barrier.disputes;

  if (input.action === 'fixed' && (barrier.fixed_reports >= 2 || barrier.disputes >= barrier.confirmations)) {
    newStatus = 'RESOLVED';
    barrier.resolved_at = now.toISOString();
    barrier.routing_penalty = 0;
  } else if (barrier.status === 'UNVERIFIED' && netConfirmations >= 3) {
    newStatus = 'COMMUNITY_VERIFIED';
  } else if (barrier.disputes >= barrier.confirmations + 2 && barrier.status !== 'RESOLVED') {
    newStatus = 'DISPUTED';
  } else if (barrier.status === 'DISPUTED' && netConfirmations >= 3) {
    newStatus = 'COMMUNITY_VERIFIED';
  }

  const statusChanged = newStatus !== previousStatus;
  barrier.status = newStatus;

  if (statusChanged) {
    barrier.timeline.push({
      id: `evt-state-${Date.now()}`,
      action: 'STATUS_CHANGED',
      actor: 'Consensus Engine',
      timestamp: now.toISOString(),
      details: `Status transitioned from ${previousStatus} to ${newStatus}.`,
    });

    // CRITICAL: Call triggerActiveBarrierRecalculation so all active user sessions recalculate
    await triggerActiveBarrierRecalculation({
      id: barrier.id,
      title: barrier.title,
      category: barrier.category,
      severity: barrier.severity,
      location: barrier.location_name,
      status: newStatus === 'COMMUNITY_VERIFIED' ? 'Verified' : 'Reported',
      votes: barrier.confirmations,
      date: 'Just now',
      createdAt: new Date(barrier.created_at).getTime(),
      ttlSeconds: 7200,
      description: barrier.description || '',
      coordinates: { lat: barrier.lat, lng: barrier.lng },
      roadLayer: 'at_grade',
      quadKey: '',
      clusterCount: barrier.cluster_count,
      isExpired: newStatus === 'EXPIRED' || newStatus === 'RESOLVED',
    });
  }

  // Record user vote to prevent duplicates
  recordUserVote(barrier.id, userId);

  // Update memory store
  memoryStore.set(barrier.id, barrier);

  // Supabase update if configured
  if (isSupabaseConfigured() && process.env.DEMO_MODE !== 'true') {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await supabase
          .from('barrier_reports')
          .update({
            confirmations: barrier.confirmations,
            disputes: barrier.disputes,
            fixed_reports: barrier.fixed_reports,
            confidence_score: barrier.confidence_score,
            routing_penalty: barrier.routing_penalty,
            status: barrier.status,
            expires_at: barrier.expires_at,
            updated_at: barrier.updated_at,
            resolved_at: barrier.resolved_at,
            timeline: barrier.timeline,
          })
          .eq('id', barrier.id);

        // Record in barrier_votes table
        await supabase.from('barrier_votes').insert({
          barrier_id: barrier.id,
          user_id: userId,
          action: input.action,
          created_at: now.toISOString(),
        });
      }
    } catch (err) {
      console.warn('[BarrierService] Supabase vote update failed, persisted in memory:', err);
    }
  }

  return {
    barrier,
    statusChanged,
    previousStatus,
    newStatus,
  };
}

/**
 * Resets the in-memory store for deterministic unit testing.
 */
export function resetBarrierStore(): void {
  memoryStore.clear();
  votedTracker.clear();
  rateLimitTracker.clear();
  SEEDED_BARRIERS.forEach((b) => memoryStore.set(b.id, { ...b }));
}
