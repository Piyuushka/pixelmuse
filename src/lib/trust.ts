/**
 * PathFinder Access - Trust & Continuous Recalibration Engine
 *
 * Replaces and generalizes entrance-only confidence scoring into a universal,
 * multi-entity trust system for Entrances, Facilities, Barriers, and Route Segments.
 *
 * Core Principles:
 * 1. Continuous Time Decay: Uses exponential half-life decay D(t) = 0.5^(t / t_half)
 *    rather than arbitrary discrete time buckets.
 * 2. Category-Specific Volatility:
 *    - Fleeting / Weather hazards (Flooding, Waterlogging, Mud): t_half = 4 hours
 *    - Temporary obstacles (Construction, Scaffolding, Roadworks): t_half = 72 hours (3 days)
 *    - Mechanical infrastructure (Elevators, Lifts, Escalators): t_half = 14 days
 *    - Physical pathways & crossings (Signalized crosswalks): t_half = 45 days
 *    - Built accessibility infrastructure (Ramps, Dropped curbs, Tactile paving): t_half = 90 days (3 months)
 *    - Architectural entrances & permanent structures: t_half = 180 days (6 months)
 * 3. Source Provenance Weighting:
 *    - Official (Municipal / Transit authority): 40 pts base
 *    - Survey (Accredited accessibility surveyor): 35 pts base
 *    - Imported (OSM / GIS layers): 25 pts base
 *    - Community (Crowdsourced field reports): 20 pts base
 * 4. Consensus & Dispute Mechanics:
 *    - Net confirmations scale up to 35 pts with Bayesian certainty
 *    - Disputes heavily penalize trust (-2x weighting, down to 0)
 * 5. Weakest-Link Route Confidence:
 *    - Computes route-level trust bounded by its most vulnerable segment.
 */

import { Entrance } from '../data/entrances';
import { IndianBarrierReport } from './barrierEngine';
import { SchematicStep, CommunityReport } from '../data/routeSimulatorData';

export type TrustLevel = 'high' | 'medium' | 'low';
export type SourceType = 'official' | 'survey' | 'community' | 'imported';

export interface TrustBreakdownItem {
  label: string;
  value: number; // positive or negative point contribution
  detail?: string;
}

export interface TrustResult {
  score: number; // 0 to 100
  level: TrustLevel;
  freshnessLabel: string;
  sourceType: SourceType;
  breakdown: TrustBreakdownItem[];
  lastUpdated: Date;
  nextReviewDue: Date;
  timeAgoText: string;
  formattedTimestamp: string;
  halfLifeHours: number;
  decayFactor: number; // 0.0 to 1.0 continuous multiplier
}

export interface TrustableItem {
  id?: string;
  name?: string;
  title?: string;
  type?: string;
  category?: string;
  source?: string;
  reportedBy?: string;
  lastVerified?: string | number | Date;
  verifiedAt?: string | number | Date;
  updatedAt?: string | number | Date;
  createdAt?: string | number | Date;
  reportedAt?: string | number | Date;
  date?: string;
  confirmations?: number;
  upvotes?: number;
  votes?: number;
  disputes?: number;
  downvotes?: number;
  status?: string;
  surface?: string;
}

// =============================================================================
// CATEGORY HALF-LIFE REGISTRY (IN HOURS)
// =============================================================================
export const HALF_LIFE_HOURS: Record<string, number> = {
  // Rapid weather & surface volatility (Hours)
  flooding: 4,
  waterlogging: 4,
  puddle: 4,
  puddles: 4,
  mud: 6,
  weather: 4,

  // Temporary blockages & roadworks (Days)
  construction: 72,        // 3 days
  scaffolding: 72,
  barricade: 48,          // 2 days
  excavation: 72,
  obstruction: 48,
  barrier: 72,

  // Mechanical accessibility assets (Weeks)
  elevator: 336,          // 14 days
  escalator: 336,
  lift: 336,

  // Pedestrian Crossings & Safety signals (1.5 Months)
  crossing: 1080,         // 45 days
  accessible_crossing: 1080,
  traffic_signal: 1080,

  // Permanent Civil Infrastructure (Months)
  ramp: 2160,             // 90 days (~3 months)
  curb_cut: 2160,
  tactile_paving: 2160,
  footpath: 2160,
  sidewalk: 2160,

  // Architectural & Building Entrances (6 Months)
  entrance: 4320,         // 180 days (~6 months)
  facility: 4320,
  door: 4320,

  // Default fallback
  default: 720,           // 30 days
};

/**
 * Resolves the continuous decay half-life in hours based on item category, type, and title.
 */
export function resolveCategoryHalfLife(item: TrustableItem): number {
  const haystack = `${item.category || ''} ${item.type || ''} ${item.title || ''} ${item.name || ''}`.toLowerCase();

  // 1. Weather / Waterlogging (fastest decay: 4-6h)
  if (haystack.includes('flood') || haystack.includes('waterlog') || haystack.includes('puddle')) {
    return HALF_LIFE_HOURS.flooding;
  }
  if (haystack.includes('mud') || haystack.includes('gravel')) {
    return HALF_LIFE_HOURS.mud;
  }

  // 2. Barricades & Roadworks (2-3 days)
  if (haystack.includes('scaffold') || haystack.includes('construction') || haystack.includes('excavat')) {
    return HALF_LIFE_HOURS.construction;
  }
  if (haystack.includes('barricade') || haystack.includes('checkpoint') || haystack.includes('blockade')) {
    return HALF_LIFE_HOURS.barricade;
  }

  // 3. Elevators & Lifts (14 days)
  if (haystack.includes('elevator') || haystack.includes('lift') || haystack.includes('escalator')) {
    return HALF_LIFE_HOURS.elevator;
  }

  // 4. Crossings (45 days)
  if (haystack.includes('crossing') || haystack.includes('crosswalk') || haystack.includes('signal')) {
    return HALF_LIFE_HOURS.crossing;
  }

  // 5. Ramps & Curbs (90 days / 3 months)
  if (haystack.includes('ramp') || haystack.includes('curb') || haystack.includes('tactile')) {
    return HALF_LIFE_HOURS.ramp;
  }

  // 6. Entrances & Facilities (180 days / 6 months)
  if (haystack.includes('entrance') || haystack.includes('gate') || haystack.includes('facility') || haystack.includes('concourse')) {
    return HALF_LIFE_HOURS.entrance;
  }

  return HALF_LIFE_HOURS.default;
}

/**
 * Calculates continuous exponential decay factor D(t) = 0.5^(elapsedHours / halfLifeHours)
 */
export function calculateContinuousDecay(elapsedHours: number, halfLifeHours: number): number {
  if (elapsedHours <= 0) return 1.0;
  // D(t) = e^(-ln(2) * t / t_half) = 0.5^(t / t_half)
  const factor = Math.pow(0.5, elapsedHours / halfLifeHours);
  return Math.max(0.01, Math.min(1.0, factor));
}

/**
 * Normalizes timestamps across varying data structures into a clean Date object.
 */
export function extractLastUpdatedDate(item: TrustableItem): Date {
  const raw =
    item.lastVerified ||
    item.verifiedAt ||
    item.updatedAt ||
    item.reportedAt ||
    item.createdAt;

  if (raw instanceof Date) return raw;
  if (typeof raw === 'number' && !isNaN(raw)) return new Date(raw);
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // If item has relative date string like "12 min ago" or "Reported 2 days ago"
  if (typeof item.date === 'string') {
    const lower = item.date.toLowerCase();
    const now = Date.now();
    if (lower.includes('min')) {
      const match = lower.match(/\d+/);
      const mins = match ? parseInt(match[0], 10) : 10;
      return new Date(now - mins * 60000);
    }
    if (lower.includes('hour') || lower.includes('hr')) {
      const match = lower.match(/\d+/);
      const hrs = match ? parseInt(match[0], 10) : 2;
      return new Date(now - hrs * 3600000);
    }
    if (lower.includes('day')) {
      const match = lower.match(/\d+/);
      const days = match ? parseInt(match[0], 10) : 3;
      return new Date(now - days * 86400000);
    }
  }

  // Fallback to recent date
  return new Date(Date.now() - 3600000);
}

/**
 * Resolves source type classification.
 */
export function resolveSourceType(item: TrustableItem): SourceType {
  const raw = `${item.source || ''} ${item.reportedBy || ''}`.toLowerCase();
  if (raw.includes('official') || raw.includes('municipal') || raw.includes('authority') || raw.includes('cpwd') || raw.includes('govt')) {
    return 'official';
  }
  if (raw.includes('survey') || raw.includes('auditor') || raw.includes('audit')) {
    return 'survey';
  }
  if (raw.includes('osm') || raw.includes('import') || raw.includes('gis')) {
    return 'imported';
  }
  return 'community';
}

/**
 * Formats a clean human-friendly relative time text.
 */
export function formatTimeAgo(date: Date, now: number = Date.now()): string {
  const elapsedMs = Math.max(0, now - date.getTime());
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedHr = Math.floor(elapsedMin / 60);
  const elapsedDay = Math.floor(elapsedHr / 24);
  const elapsedMonth = Math.floor(elapsedDay / 30);

  if (elapsedMin < 1) return 'Just now';
  if (elapsedMin < 60) return `${elapsedMin} min ago`;
  if (elapsedHr < 24) return `${elapsedHr} hr${elapsedHr === 1 ? '' : 's'} ago`;
  if (elapsedDay < 30) return `${elapsedDay} day${elapsedDay === 1 ? '' : 's'} ago`;
  if (elapsedMonth < 12) return `${elapsedMonth} month${elapsedMonth === 1 ? '' : 's'} ago`;
  return `${Math.floor(elapsedDay / 365)} year(s) ago`;
}

// =============================================================================
// MAIN TRUST COMPUTATION PIPELINE
// =============================================================================

/**
 * Computes deterministic trust metrics for any entrance, facility, barrier report, or route segment.
 *
 * @param item - Entrance, Facility, IndianBarrierReport, or Route Segment.
 * @param nowTimestamp - Optional override for deterministic unit testing.
 */
export function computeTrust(item: TrustableItem, nowTimestamp?: number): TrustResult {
  const now = nowTimestamp ?? Date.now();
  const lastUpdated = extractLastUpdatedDate(item);
  const elapsedMs = Math.max(0, now - lastUpdated.getTime());
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  const halfLifeHours = resolveCategoryHalfLife(item);
  const decayFactor = calculateContinuousDecay(elapsedHours, halfLifeHours);
  const sourceType = resolveSourceType(item);

  const breakdown: TrustBreakdownItem[] = [];
  let score = 0;

  // 1. Source Provenance Component (Max 40 points)
  let baseSourcePoints = 20;
  if (sourceType === 'official') baseSourcePoints = 40;
  else if (sourceType === 'survey') baseSourcePoints = 35;
  else if (sourceType === 'imported') baseSourcePoints = 25;
  else baseSourcePoints = 20; // community

  score += baseSourcePoints;
  breakdown.push({
    label: `${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)} Source`,
    value: baseSourcePoints,
    detail: `Base weight assigned to ${sourceType} verification data.`,
  });

  // 2. Continuous Recency Decay Component (Max 35 points scaled by decayFactor)
  const maxRecencyPoints = 35;
  const recencyScore = Math.round(maxRecencyPoints * decayFactor);
  score += recencyScore;

  const halfLifeLabel = halfLifeHours < 24
    ? `${halfLifeHours} hrs`
    : `${Math.round(halfLifeHours / 24)} days`;

  breakdown.push({
    label: 'Continuous Freshness Decay',
    value: recencyScore,
    detail: `Half-life: ${halfLifeLabel}. Decay factor: ${(decayFactor * 100).toFixed(1)}% (${elapsedHours < 24 ? `${elapsedHours.toFixed(1)}h` : `${(elapsedHours / 24).toFixed(1)}d`} elapsed).`,
  });

  // 3. Consensus & Dispute Mechanics (Max 25 points, with dispute penalty)
  const confirmations = item.confirmations ?? item.upvotes ?? item.votes ?? 0;
  const disputes = item.disputes ?? item.downvotes ?? 0;

  let consensusPoints = 0;
  if (confirmations === 0 && disputes === 0) {
    // Unverified item
    consensusPoints = sourceType === 'official' || sourceType === 'survey' ? 10 : 0;
    breakdown.push({
      label: 'Community Consensus',
      value: consensusPoints,
      detail: 'No community confirmations recorded yet.',
    });
  } else {
    // Net positive confirmations
    const netConfirmations = confirmations - (disputes * 2);

    if (disputes > 0 && disputes >= confirmations) {
      // Disputed item: major penalty
      consensusPoints = -25;
      breakdown.push({
        label: 'Disputed Verification',
        value: -25,
        detail: `Item has ${disputes} dispute(s) exceeding ${confirmations} confirmation(s). Trust significantly degraded.`,
      });
    } else if (netConfirmations > 50) {
      consensusPoints = 25;
      breakdown.push({
        label: 'Consensus: Exceptional (>50 net confirmations)',
        value: 25,
        detail: `${confirmations} confirmations vs ${disputes} disputes.`,
      });
    } else if (netConfirmations > 10) {
      consensusPoints = 18;
      breakdown.push({
        label: 'Consensus: High (>10 net confirmations)',
        value: 18,
        detail: `${confirmations} confirmations vs ${disputes} disputes.`,
      });
    } else if (netConfirmations > 0) {
      consensusPoints = 10;
      breakdown.push({
        label: 'Consensus: Moderate (>0 net confirmations)',
        value: 10,
        detail: `${confirmations} confirmations vs ${disputes} disputes.`,
      });
    } else {
      consensusPoints = -10;
      breakdown.push({
        label: 'Consensus: Strained',
        value: -10,
        detail: `Disputes (${disputes}) detract from credibility.`,
      });
    }
  }

  score += consensusPoints;

  // Clamp score strictly between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine Level: High (>=70), Medium (40-69), Low (<40)
  let level: TrustLevel = 'low';
  if (score >= 70) level = 'high';
  else if (score >= 40) level = 'medium';
  else level = 'low';

  // Calculate Next Review Due: lastUpdated + halfLifeHours
  const nextReviewDue = new Date(lastUpdated.getTime() + halfLifeHours * 3600000);

  // Freshness Label
  const timeAgoText = formatTimeAgo(lastUpdated, now);
  let freshnessLabel = `Updated ${timeAgoText}`;
  if (decayFactor < 0.25) {
    freshnessLabel = `Stale verification (${timeAgoText})`;
  } else if (decayFactor < 0.5) {
    freshnessLabel = `Review recommended (${timeAgoText})`;
  } else if (elapsedHours < 1) {
    freshnessLabel = 'Freshly verified';
  }

  const formattedTimestamp = lastUpdated.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return {
    score,
    level,
    freshnessLabel,
    sourceType,
    breakdown,
    lastUpdated,
    nextReviewDue,
    timeAgoText,
    formattedTimestamp,
    halfLifeHours,
    decayFactor,
  };
}

// =============================================================================
// WEAKEST-LINK ROUTE CONFIDENCE ANALYSIS
// =============================================================================

export interface RouteConfidenceResult {
  overallLevel: TrustLevel;
  overallScore: number;
  weakestSegment: {
    segmentId: string;
    title: string;
    trust: TrustResult;
  } | null;
  staleSegmentsCount: number;
  lowConfidenceCount: number;
  summary: string;
  warningMessage: string | null;
  needsSaferAlternative: boolean;
  segmentsAuditedCount: number;
}

export interface RouteSegmentItem {
  id?: string;
  title?: string;
  type?: string;
  detail?: string;
  lastVerified?: string | number | Date;
  updatedAt?: string | number | Date;
  confirmations?: number;
  disputes?: number;
  source?: string;
}

export type RouteInput =
  | { steps?: RouteSegmentItem[]; normalSteps?: RouteSegmentItem[]; accessibleSteps?: RouteSegmentItem[]; segments?: RouteSegmentItem[] }
  | RouteSegmentItem[];

/**
 * Computes the weakest-link summary across all segments of a route.
 * Identifies stale segments (not verified in 90+ days or exceeding category half-life)
 * and flags low-confidence route dependencies.
 */
export function routeConfidence(
  route: RouteInput,
  nowTimestamp?: number
): RouteConfidenceResult {
  const now = nowTimestamp ?? Date.now();
  let steps: RouteSegmentItem[] = [];

  if (Array.isArray(route)) {
    steps = route;
  } else if (route) {
    steps =
      route.accessibleSteps ||
      route.steps ||
      route.normalSteps ||
      route.segments ||
      [];
  }

  if (steps.length === 0) {
    return {
      overallLevel: 'high',
      overallScore: 85,
      weakestSegment: null,
      staleSegmentsCount: 0,
      lowConfidenceCount: 0,
      summary: 'High: All segments verified',
      warningMessage: null,
      needsSaferAlternative: false,
      segmentsAuditedCount: 0,
    };
  }

  let minScore = 100;
  let weakest: { segmentId: string; title: string; trust: TrustResult } | null = null;
  let staleCount = 0;
  let lowConfidenceCount = 0;

  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx];
    const trust = computeTrust(step as TrustableItem, now);

    if (trust.score < minScore) {
      minScore = trust.score;
      weakest = {
        segmentId: step.id || `step-${idx}`,
        title: step.title || `Segment ${idx + 1}`,
        trust,
      };
    }

    // Flag stale if elapsed time exceeds half-life or > 90 days
    const elapsedDays = (now - trust.lastUpdated.getTime()) / 86400000;
    if (elapsedDays >= 90 || trust.decayFactor < 0.35) {
      staleCount++;
    }

    if (trust.level === 'low') {
      lowConfidenceCount++;
    }
  }

  // Check if any segment is actually disputed or heavily flagged
  const hasDisputedOrCritical = steps.some((step) => {
    const disputes = step.disputes ?? 0;
    const confirms = step.confirmations ?? 0;
    return (disputes > 0 && disputes >= confirms) || (step as any).downvotes > 0;
  });

  let overallLevel: TrustLevel = 'high';
  if (hasDisputedOrCritical || (minScore < 30 && staleCount === 0)) {
    overallLevel = 'low';
  } else if (staleCount > 0 || minScore < 70) {
    overallLevel = 'medium';
  } else {
    overallLevel = 'high';
  }

  // Summary Construction (e.g. "Medium: 2 segments not verified in 90+ days")
  let summary = 'High: Fully verified navigation path';
  let warningMessage: string | null = null;
  let needsSaferAlternative = false;

  if (staleCount > 0) {
    overallLevel = hasDisputedOrCritical ? 'low' : 'medium';
    needsSaferAlternative = true;
    summary = `Medium: ${staleCount} segment${staleCount === 1 ? '' : 's'} not verified in 90+ days`;
    warningMessage = `Notice: ${staleCount} segment(s) along this route haven't been re-verified in 90+ days. Ramp or sidewalk conditions may have changed.`;
    if (hasDisputedOrCritical) {
      summary = `Low: Route contains stale segments and active disputes`;
      warningMessage = `Caution: Route depends on unverified or disputed paths (${weakest?.title || 'Segment'}). Step-free continuity cannot be guaranteed.`;
    }
  } else if (overallLevel === 'low') {
    needsSaferAlternative = true;
    summary = `Low: ${lowConfidenceCount} segment${lowConfidenceCount === 1 ? ' has' : 's have'} unconfirmed or disputed accessibility data`;
    warningMessage = `Caution: Route depends on unverified or disputed paths (${weakest?.title || 'Segment'}). Step-free continuity cannot be guaranteed.`;
  } else if (overallLevel === 'medium') {
    needsSaferAlternative = false;
    summary = 'Medium: Moderate community confidence along route';
  }

  return {
    overallLevel,
    overallScore: minScore,
    weakestSegment: weakest,
    staleSegmentsCount: staleCount,
    lowConfidenceCount,
    summary,
    warningMessage,
    needsSaferAlternative,
    segmentsAuditedCount: steps.length,
  };
}
