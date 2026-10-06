/**
 * PathFinder Access - Barrier Service Layer
 *
 * Provides database-agnostic business logic for:
 * - Computing expires_at from Indian road category TTLs
 * - Upvote / downvote → confidence score recalculation
 * - Dynamic routing penalty updates
 * - Cluster merging within 20-meter radius
 *
 * Integrates with both PostgreSQL (schema.sql) and MongoDB (mongoSchema.ts).
 * Can be used from API routes or background workers.
 */

import {
  BarrierCategory,
  BarrierStatus,
  RoadLayerType,
  IBarrierReport,
  CATEGORY_TTL_MINUTES,
  CATEGORY_BASE_PENALTY,
} from './mongoSchema';

// ============================================================
// TTL & EXPIRY COMPUTATION
// ============================================================

/**
 * Compute expiry timestamp based on Indian road scenario category.
 * @param category - BarrierCategory enum value
 * @param fromDate - base timestamp (defaults to now)
 */
export function computeExpiresAt(
  category: BarrierCategory,
  fromDate: Date = new Date()
): Date {
  const ttlMinutes = CATEGORY_TTL_MINUTES[category] ?? 240;
  const expiresAt = new Date(fromDate.getTime() + ttlMinutes * 60 * 1000);
  return expiresAt;
}

/**
 * Extend TTL by N minutes — called on community upvote confirmation.
 * Extension capped at 2× the original default TTL for the category.
 */
export function extendTTL(
  report: IBarrierReport,
  extensionMinutes: number = 30
): Date {
  const maxTTLMinutes = CATEGORY_TTL_MINUTES[report.category] * 2;
  const maxExpiresAt = new Date(
    report.created_at.getTime() + maxTTLMinutes * 60 * 1000
  );
  const extended = new Date(
    report.expires_at.getTime() + extensionMinutes * 60 * 1000
  );
  return extended < maxExpiresAt ? extended : maxExpiresAt;
}

/**
 * Reduce TTL by N minutes — called on community downvote.
 * Minimum floor is NOW + 5 minutes (prevents instant negative race).
 */
export function reduceTTL(
  report: IBarrierReport,
  reductionMinutes: number = 45
): Date {
  const reduced = new Date(
    report.expires_at.getTime() - reductionMinutes * 60 * 1000
  );
  const floor = new Date(Date.now() + 5 * 60 * 1000);
  return reduced < floor ? floor : reduced;
}

// ============================================================
// CONFIDENCE SCORE
// ============================================================

/**
 * Derives a [0.0 → 1.0] confidence score from community vote ratio.
 *
 * Formula: ((upvotes - downvotes × 1.5) / (upvotes + downvotes + 1))
 *          normalized and clamped to [0, 1].
 *
 * A report with 5 upvotes, 0 downvotes → score ≈ 0.83
 * A report with 2 upvotes, 4 downvotes → score ≈ 0.07 (approaching expiry)
 */
export function computeConfidenceScore(
  upvotes: number,
  downvotes: number
): number {
  if (upvotes + downvotes === 0) return 1.0;
  const raw = (upvotes - downvotes * 1.5) / (upvotes + downvotes + 1);
  const normalized = (raw + 1.0) / 2.0; // shift [-1,1] → [0,1]
  return Math.max(0.0, Math.min(1.0, normalized));
}

// ============================================================
// ROUTING PENALTY
// ============================================================

/**
 * Computes the final routing graph edge penalty for a barrier.
 * Base penalty scaled by confidence score — low confidence = low penalty
 * (community thinks it might not exist anymore).
 *
 * Road layer guard: if barrier is on FLYOVER and edge is SERVICE_ROAD
 * (or vice versa), penalty is 0 (prevents false blocking of parallel lanes).
 */
export function computeRoutingPenalty(
  category: BarrierCategory,
  confidenceScore: number,
  barrierLayer: RoadLayerType,
  edgeLayer: RoadLayerType
): number {
  // Prevent false positives: flyover ≠ service road beneath
  if (
    (barrierLayer === RoadLayerType.FLYOVER && edgeLayer === RoadLayerType.SERVICE_ROAD) ||
    (barrierLayer === RoadLayerType.SERVICE_ROAD && edgeLayer === RoadLayerType.FLYOVER)
  ) {
    return 0;
  }

  const basePenalty = CATEGORY_BASE_PENALTY[category] ?? 4000;
  return basePenalty * Math.max(0.1, confidenceScore); // floor at 10% to keep some signal
}

// ============================================================
// REPORT CREATION
// ============================================================

export interface CreateBarrierInput {
  user_id: string;
  category: BarrierCategory;
  lng: number;
  lat: number;
  location_name?: string;
  road_segment_id?: string;
  osm_way_id?: number;
  road_layer?: RoadLayerType;
  description?: string;
  photo_url?: string;
}

/**
 * Construct a validated IBarrierReport object ready for database insertion.
 * All TTL, confidence, and penalty fields are auto-derived.
 */
export function buildBarrierReport(input: CreateBarrierInput): Omit<IBarrierReport, '_id'> {
  const now = new Date();
  const category = input.category;
  const upvotes = 1;
  const downvotes = 0;
  const confidenceScore = computeConfidenceScore(upvotes, downvotes);
  const layer = input.road_layer ?? RoadLayerType.AT_GRADE;

  return {
    user_id: input.user_id,
    category,
    status: BarrierStatus.PENDING,

    location: {
      type: 'Point',
      coordinates: [input.lng, input.lat],
    },
    location_name: input.location_name,

    road_segment_id: input.road_segment_id,
    osm_way_id: input.osm_way_id,
    road_layer: layer,

    upvotes,
    downvotes,
    cluster_count: 1,
    confidence_score: confidenceScore,

    routing_penalty: computeRoutingPenalty(category, confidenceScore, layer, layer),

    created_at: now,
    expires_at: computeExpiresAt(category, now),
    updated_at: now,

    description: input.description,
    photo_url: input.photo_url,
    is_clustered: false,
    parent_report_id: undefined,
  };
}

// ============================================================
// UPVOTE / DOWNVOTE HANDLERS
// ============================================================

/**
 * Apply community upvote: extends TTL +30 min, increments score, activates if PENDING.
 */
export function applyUpvote(report: IBarrierReport): Partial<IBarrierReport> {
  const newUpvotes = report.upvotes + 1;
  const confidence = computeConfidenceScore(newUpvotes, report.downvotes);
  const newExpiresAt = extendTTL(report, 30);
  const newPenalty = computeRoutingPenalty(
    report.category, confidence, report.road_layer, report.road_layer
  );

  return {
    upvotes: newUpvotes,
    confidence_score: confidence,
    routing_penalty: newPenalty,
    expires_at: newExpiresAt,
    status: report.status === BarrierStatus.PENDING && confidence >= 0.5
      ? BarrierStatus.ACTIVE
      : report.status,
    updated_at: new Date(),
  };
}

/**
 * Apply community downvote: reduces TTL -45 min, reduces score, may auto-expire.
 */
export function applyDownvote(report: IBarrierReport): Partial<IBarrierReport> {
  const newDownvotes = report.downvotes + 1;
  const confidence = computeConfidenceScore(report.upvotes, newDownvotes);
  const newExpiresAt = reduceTTL(report, 45);
  const shouldExpire = newDownvotes >= report.upvotes + 3 || newExpiresAt <= new Date();

  return {
    downvotes: newDownvotes,
    confidence_score: confidence,
    routing_penalty: shouldExpire ? 0 : computeRoutingPenalty(
      report.category, confidence, report.road_layer, report.road_layer
    ),
    expires_at: newExpiresAt,
    status: shouldExpire ? BarrierStatus.EXPIRED : report.status,
    resolved_at: shouldExpire ? new Date() : report.resolved_at,
    updated_at: new Date(),
  };
}

// ============================================================
// 20-METER CLUSTERING CHECK (in-service logic, no DB required)
// ============================================================

/**
 * Haversine distance in meters between two [lng, lat] GeoJSON coordinates.
 */
export function haversineMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const R = 6371000;
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const dLng = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Produces an update patch that merges an incoming report into an existing cluster.
 */
export function mergeIntoCluster(
  existing: IBarrierReport,
  incoming: CreateBarrierInput
): Partial<IBarrierReport> {
  const newUpvotes = existing.upvotes + 1;
  const confidence = computeConfidenceScore(newUpvotes, existing.downvotes);
  const newExpiresAt = extendTTL(existing, 30);

  return {
    upvotes: newUpvotes,
    cluster_count: existing.cluster_count + 1,
    is_clustered: true,
    confidence_score: confidence,
    routing_penalty: computeRoutingPenalty(
      existing.category, confidence, existing.road_layer, existing.road_layer
    ),
    expires_at: newExpiresAt,
    description: existing.description
      ? `${existing.description} | Re-confirmed by navigator.`
      : 'Re-confirmed by community navigator.',
    status: confidence >= 0.5 ? BarrierStatus.ACTIVE : existing.status,
    updated_at: new Date(),
  };
}
