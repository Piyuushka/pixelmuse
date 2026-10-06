import { PersonaType } from '@/context/AccessibilityContext';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CrossingType = 'signal' | 'zebra' | 'refuge' | 'uncontrolled' | 'none';
export type FootpathSurface = 'smooth' | 'tactile' | 'rough' | 'broken' | 'missing' | 'cobblestone' | 'unpaved';
export type SafetyLabel = 'safe' | 'moderate' | 'caution';

export interface SurfaceFilterPreferences {
  avoidCobblestones: boolean;
  avoidUnpavedGravel: boolean;
  avoidSteepInclines: boolean;
  preferTactilePaving: boolean;
  preferSignalizedCrossings: boolean;
  wellLitOnly: boolean;
}

export const DEFAULT_SURFACE_FILTERS: SurfaceFilterPreferences = {
  avoidCobblestones: false,
  avoidUnpavedGravel: false,
  avoidSteepInclines: false,
  preferTactilePaving: false,
  preferSignalizedCrossings: false,
  wellLitOnly: false,
};

export interface SurfaceQualityBadge {
  label: string;
  type: 'safe' | 'caution' | 'warning' | 'info';
  iconName?: string;
}

export interface SegmentSafetyProfile {
  id: string;
  name: string;
  distanceMeters: number;

  // Raw attributes
  isLit: boolean;
  streetlampDensityPerKm: number;    // e.g. 12 = well lit
  hasTactilePaving: boolean;
  footpathSurface: FootpathSurface;
  footpathWidthCm: number;            // >= 120 cm = fully accessible
  hasSteps: boolean;
  stepCount: number;
  maxSlopePercent: number;            // 0 = flat, 5 = gentle, > 8 = steep
  crossingType: CrossingType;
  hasPelicanSignal: boolean;
  hasRefugeIsland: boolean;
  obstacleFreeLineOfSight: boolean;
  estimatedCrowdDensity: 'low' | 'moderate' | 'high';
  lastAuditedAt: string;              // ISO date string

  // Computed (0–20 each)
  lightingScore: number;
  crossingScore: number;
  footpathScore: number;
  slopeScore: number;
  visibilityScore: number;
  totalScore: number;                 // 0–100
}

export interface RouteWithSafety {
  routeId: string;
  label: string;
  color: string;                      // Tailwind token colour for map overlay
  distanceMeters: number;
  estimatedMinutes: number;
  segments: SegmentSafetyProfile[];
  compositeSafetyScore: number;       // weighted average across segments
  safetyLabel: SafetyLabel;
  personaSuitability: Record<PersonaType, boolean>;
  nightSafetyScore: number;           // re-weighted with 40% lighting
  isRecommendedForPersona: boolean;   // set by rankRoutesForPersona
  surfaceQualityBadges: SurfaceQualityBadge[];
  filterViolations: string[];
  isBlockedByHazard?: boolean;
  hazardBlockReason?: string;
  detourNotice?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTS
// ─────────────────────────────────────────────────────────────────────────────

/** Day-mode weights (each out of 20, total = 100) */
const DAY_WEIGHTS = {
  lighting:   0.20,
  crossing:   0.20,
  footpath:   0.20,
  slope:      0.20,
  visibility: 0.20,
};

/** Night-mode: lighting doubles to 40%, others share remaining 60% equally */
const NIGHT_WEIGHTS = {
  lighting:   0.40,
  crossing:   0.15,
  footpath:   0.15,
  slope:      0.15,
  visibility: 0.15,
};

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT SCORING
// ─────────────────────────────────────────────────────────────────────────────

/** Computes raw sub-scores (0–20 each) for a segment's raw attributes. */
function computeSubScores(seg: Omit<SegmentSafetyProfile, 'lightingScore' | 'crossingScore' | 'footpathScore' | 'slopeScore' | 'visibilityScore' | 'totalScore'>): {
  lightingScore: number;
  crossingScore: number;
  footpathScore: number;
  slopeScore: number;
  visibilityScore: number;
} {
  // ── Lighting (0–20) ──────────────────────────────────────────────────────
  let lightingScore = 0;
  if (seg.isLit) lightingScore += 12;
  if (seg.streetlampDensityPerKm >= 10) lightingScore += 8;
  else if (seg.streetlampDensityPerKm >= 6) lightingScore += 5;
  else if (seg.streetlampDensityPerKm >= 3) lightingScore += 2;
  lightingScore = Math.min(20, lightingScore);

  // ── Crossing (0–20) ──────────────────────────────────────────────────────
  let crossingScore = 0;
  switch (seg.crossingType) {
    case 'signal':       crossingScore = 16; break;
    case 'zebra':        crossingScore = 12; break;
    case 'refuge':       crossingScore = 10; break;
    case 'uncontrolled': crossingScore = 5;  break;
    case 'none':         crossingScore = 2;  break;
  }
  if (seg.hasPelicanSignal) crossingScore = Math.min(20, crossingScore + 3);
  if (seg.hasRefugeIsland)  crossingScore = Math.min(20, crossingScore + 2);

  // ── Footpath (0–20) ──────────────────────────────────────────────────────
  let footpathScore = 0;
  switch (seg.footpathSurface) {
    case 'smooth':      footpathScore = 10; break;
    case 'tactile':     footpathScore = 12; break;
    case 'rough':       footpathScore = 6;  break;
    case 'unpaved':     footpathScore = 4;  break;
    case 'cobblestone': footpathScore = 3;  break;
    case 'broken':      footpathScore = 2;  break;
    case 'missing':     footpathScore = 0;  break;
  }
  if (seg.hasTactilePaving) footpathScore = Math.min(20, footpathScore + 4);
  if (seg.footpathWidthCm >= 180) footpathScore = Math.min(20, footpathScore + 4);
  else if (seg.footpathWidthCm >= 120) footpathScore = Math.min(20, footpathScore + 2);
  else if (seg.footpathWidthCm < 90)  footpathScore = Math.max(0, footpathScore - 4);

  // ── Slope / Steps (0–20) ─────────────────────────────────────────────────
  let slopeScore = 20;
  if (seg.hasSteps) slopeScore -= Math.min(16, seg.stepCount * 4);
  if (seg.maxSlopePercent > 8)      slopeScore -= 10;
  else if (seg.maxSlopePercent > 5) slopeScore -= 6;
  else if (seg.maxSlopePercent > 3) slopeScore -= 2;
  slopeScore = Math.max(0, slopeScore);

  // ── Visibility / Sightlines (0–20) ────────────────────────────────────────
  let visibilityScore = 0;
  if (seg.obstacleFreeLineOfSight) visibilityScore += 14;
  switch (seg.estimatedCrowdDensity) {
    case 'low':      visibilityScore += 6; break;
    case 'moderate': visibilityScore += 3; break;
    case 'high':     visibilityScore += 0; break;
  }
  visibilityScore = Math.min(20, visibilityScore);

  return { lightingScore, crossingScore, footpathScore, slopeScore, visibilityScore };
}

/**
 * Scores a segment and returns it with computed sub-scores and totalScore.
 * Pass nightMode=true to re-weight lighting to 40%.
 */
export function scoreSegment(
  raw: Omit<SegmentSafetyProfile, 'lightingScore' | 'crossingScore' | 'footpathScore' | 'slopeScore' | 'visibilityScore' | 'totalScore'>,
  nightMode = false,
): SegmentSafetyProfile {
  const { lightingScore, crossingScore, footpathScore, slopeScore, visibilityScore } = computeSubScores(raw);
  const w = nightMode ? NIGHT_WEIGHTS : DAY_WEIGHTS;

  const totalScore = Math.round(
    lightingScore   * (w.lighting   / 0.20) +
    crossingScore   * (w.crossing   / 0.20) +
    footpathScore   * (w.footpath   / 0.20) +
    slopeScore      * (w.slope      / 0.20) +
    visibilityScore * (w.visibility / 0.20)
  );
  // Normalise back to 0–100
  const normalisedTotal = Math.min(100, Math.round(totalScore / 5));

  return {
    ...raw,
    lightingScore,
    crossingScore,
    footpathScore,
    slopeScore,
    visibilityScore,
    totalScore: normalisedTotal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELS & SUITABILITY
// ─────────────────────────────────────────────────────────────────────────────

export function getSafetyLabel(score: number): SafetyLabel {
  if (score >= 80) return 'safe';
  if (score >= 50) return 'moderate';
  return 'caution';
}

/**
 * Returns true if the route as a whole meets the minimum thresholds for a
 * given persona. Rules:
 *
 * wheelchair  — no steps, slope ≤ 5%, footpath ≥ 120 cm wide, no missing footpath
 * low-vision  — has tactile paving on ≥ 50% of segments, crossing is signal or zebra
 * older-adult — slope ≤ 5%, no broken surface, crossing is not uncontrolled/none
 * caregiver   — footpath ≥ 120 cm, no missing footpath
 */
export function getPersonaSuitability(
  route: Pick<RouteWithSafety, 'segments'>,
  persona: PersonaType,
): boolean {
  const segs = route.segments;
  if (segs.length === 0) return false;

  switch (persona) {
    case 'wheelchair': {
      const hasSteps = segs.some(s => s.hasSteps && s.stepCount > 0);
      const hasSteepSlope = segs.some(s => s.maxSlopePercent > 5);
      const hasMissingPath = segs.some(s => s.footpathSurface === 'missing');
      const hasNarrowPath = segs.some(s => s.footpathWidthCm < 120);
      return !hasSteps && !hasSteepSlope && !hasMissingPath && !hasNarrowPath;
    }

    case 'low-vision': {
      const tactileRatio = segs.filter(s => s.hasTactilePaving).length / segs.length;
      const badCrossings = segs.some(s => s.crossingType === 'none' || s.crossingType === 'uncontrolled');
      return tactileRatio >= 0.5 && !badCrossings;
    }

    case 'older-adult': {
      const hasSteepSlope = segs.some(s => s.maxSlopePercent > 5);
      const hasBrokenSurface = segs.some(s => s.footpathSurface === 'broken' || s.footpathSurface === 'missing');
      const hasUnsafeCrossing = segs.some(s => s.crossingType === 'none' || s.crossingType === 'uncontrolled');
      return !hasSteepSlope && !hasBrokenSurface && !hasUnsafeCrossing;
    }

    case 'caregiver': {
      const hasMissingPath = segs.some(s => s.footpathSurface === 'missing');
      const hasNarrowPath = segs.some(s => s.footpathWidthCm < 120);
      return !hasMissingPath && !hasNarrowPath;
    }

    case 'none':
    default:
      return true;
  }
}

/** Composite score = mean of segment totalScores */
function compositeScore(segments: SegmentSafetyProfile[]): number {
  if (segments.length === 0) return 0;
  return Math.round(segments.reduce((acc, s) => acc + s.totalScore, 0) / segments.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE & INFRASTRUCTURE EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

export function computeSurfaceQualityBadges(segments: SegmentSafetyProfile[]): SurfaceQualityBadge[] {
  const badges: SurfaceQualityBadge[] = [];

  const allSmooth = segments.every(s => s.footpathSurface === 'smooth' || s.footpathSurface === 'tactile');
  if (allSmooth) {
    badges.push({ label: 'Smooth Concrete', type: 'safe' });
  }

  if (segments.some(s => s.hasTactilePaving)) {
    badges.push({ label: 'Tactile Paving Verified', type: 'info' });
  }

  const maxSlope = Math.max(...segments.map(s => s.maxSlopePercent));
  if (maxSlope > 5) {
    badges.push({ label: `Steep Slope Warning (${maxSlope}%)`, type: 'warning' });
  } else if (maxSlope > 0) {
    badges.push({ label: `Gentle Incline (${maxSlope}%)`, type: 'safe' });
  }

  if (segments.some(s => s.footpathSurface === 'cobblestone')) {
    badges.push({ label: 'Cobblestones', type: 'caution' });
  }

  if (segments.some(s => s.footpathSurface === 'unpaved' || s.footpathSurface === 'rough')) {
    badges.push({ label: 'Unpaved / Gravel Path', type: 'caution' });
  }

  if (segments.some(s => s.crossingType === 'signal' || s.hasPelicanSignal)) {
    badges.push({ label: 'Signalized Crossing', type: 'safe' });
  }

  if (segments.every(s => s.isLit && s.streetlampDensityPerKm >= 8)) {
    badges.push({ label: 'Well-Lit Corridor', type: 'safe' });
  } else if (segments.some(s => !s.isLit || s.streetlampDensityPerKm < 4)) {
    badges.push({ label: 'Low Visibility Warning', type: 'caution' });
  }

  return badges;
}

export function evaluateFilterViolations(
  segments: SegmentSafetyProfile[],
  filters?: SurfaceFilterPreferences,
): { penalty: number; violations: string[] } {
  if (!filters) return { penalty: 0, violations: [] };

  let penalty = 0;
  const violations: string[] = [];

  if (filters.avoidCobblestones && segments.some(s => s.footpathSurface === 'cobblestone')) {
    penalty += 35;
    violations.push('Violates Avoid Cobblestones (Cobblestone segment present)');
  }

  if (filters.avoidUnpavedGravel && segments.some(s => s.footpathSurface === 'unpaved' || s.footpathSurface === 'rough')) {
    penalty += 25;
    violations.push('Violates Avoid Unpaved/Gravel (Contains loose gravel / unpaved path)');
  }

  if (filters.avoidSteepInclines && segments.some(s => s.maxSlopePercent > 5)) {
    penalty += 35;
    violations.push('Violates Avoid Steep Inclines (Exceeds 5% slope threshold)');
  }

  if (filters.preferTactilePaving) {
    const hasTactile = segments.some(s => s.hasTactilePaving);
    if (!hasTactile) {
      penalty += 20;
      violations.push('Lacks Tactile Paving infrastructure');
    } else {
      penalty -= 10; // Reward
    }
  }

  if (filters.preferSignalizedCrossings) {
    const hasSignal = segments.some(s => s.crossingType === 'signal' || s.hasPelicanSignal);
    if (!hasSignal) {
      penalty += 20;
      violations.push('Lacks Signalized Pedestrian Crossings');
    } else {
      penalty -= 10; // Reward
    }
  }

  if (filters.wellLitOnly && segments.some(s => !s.isLit || s.streetlampDensityPerKm < 6)) {
    penalty += 40;
    violations.push('Violates Well-Lit Only (Dark/low-light corridor)');
  }

  return { penalty, violations };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE RANKING WITH DYNAMIC OBSTACLE AVOIDANCE & SURFACE WEIGHTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ranks an array of routes for a given persona, night mode, surface filters,
 * and live reported obstacles.
 * Sets isRecommendedForPersona = true on the best-suited route.
 * Returns a sorted copy (best first).
 */
export function rankRoutesForPersona(
  routes: RouteWithSafety[],
  persona: PersonaType,
  nightMode = false,
  surfaceFilters?: SurfaceFilterPreferences,
  activeObstacleAlert?: { active: boolean; title?: string; location?: string; category?: string } | null,
): RouteWithSafety[] {
  const scored = routes.map(route => {
    const rescoredSegments = route.segments.map(s => scoreSegment(s, nightMode));
    const baseScore = compositeScore(rescoredSegments);
    const nightScore = compositeScore(segmentsWithNight(route.segments));
    
    // Evaluate surface filters
    const { penalty, violations } = evaluateFilterViolations(route.segments, surfaceFilters);
    const finalDayScore = Math.max(5, Math.min(100, baseScore - penalty));
    const finalNightScore = Math.max(5, Math.min(100, nightScore - penalty));

    const personaSuitability: Record<PersonaType, boolean> = {
      'wheelchair': getPersonaSuitability(route, 'wheelchair'),
      'low-vision': getPersonaSuitability(route, 'low-vision'),
      'older-adult': getPersonaSuitability(route, 'older-adult'),
      'caregiver': getPersonaSuitability(route, 'caregiver'),
      'none': getPersonaSuitability(route, 'none'),
    };

    // If severe violations exist, adjust suitability
    if (violations.length > 0 && (surfaceFilters?.avoidCobblestones || surfaceFilters?.avoidSteepInclines)) {
      if (route.segments.some(s => s.footpathSurface === 'cobblestone' || s.maxSlopePercent > 5)) {
        personaSuitability[persona] = false;
      }
    }

    const currentScore = nightMode ? finalNightScore : finalDayScore;

    // Check dynamic obstacle avoidance on active route
    const isBlocked = !!(
      activeObstacleAlert?.active &&
      (route.routeId === 'route-a' ||
       route.label.toLowerCase().includes('concourse') ||
       route.segments.some(s => s.name.toLowerCase().includes('elevator') || s.name.toLowerCase().includes('concourse')))
    );

    return {
      ...route,
      segments: rescoredSegments,
      compositeSafetyScore: isBlocked ? Math.max(10, currentScore - 60) : currentScore,
      nightSafetyScore: isBlocked ? Math.max(10, finalNightScore - 60) : finalNightScore,
      personaSuitability,
      safetyLabel: getSafetyLabel(isBlocked ? 25 : currentScore),
      surfaceQualityBadges: computeSurfaceQualityBadges(route.segments),
      filterViolations: violations,
      isBlockedByHazard: isBlocked,
      hazardBlockReason: isBlocked ? (activeObstacleAlert?.title || 'Reported Barrier on Concourse Path') : undefined,
      detourNotice: !isBlocked && activeObstacleAlert?.active && route.routeId === 'route-b' ? '+2 min detour' : undefined,
      isRecommendedForPersona: false,
    };
  });

  // Sort: non-blocked first, then persona-suitable, then composite score desc
  scored.sort((a, b) => {
    // 1. Unblocked routes prioritized over blocked ones
    if (a.isBlockedByHazard !== b.isBlockedByHazard) {
      return a.isBlockedByHazard ? 1 : -1;
    }
    // 2. Persona suitability
    const aFit = a.personaSuitability[persona] ? 1 : 0;
    const bFit = b.personaSuitability[persona] ? 1 : 0;
    if (aFit !== bFit) return bFit - aFit;
    // 3. Composite score
    const aScore = nightMode ? a.nightSafetyScore : a.compositeSafetyScore;
    const bScore = nightMode ? b.nightSafetyScore : b.compositeSafetyScore;
    return bScore - aScore;
  });

  // Top unblocked route becomes the recommended route
  const firstUnblocked = scored.find(r => !r.isBlockedByHazard);
  if (firstUnblocked) {
    firstUnblocked.isRecommendedForPersona = true;
  } else if (scored.length > 0) {
    scored[0].isRecommendedForPersona = true;
  }

  return scored;
}

function segmentsWithNight(segs: SegmentSafetyProfile[]): SegmentSafetyProfile[] {
  return segs.map(s => scoreSegment(s, true));
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO DATA  — realistic Mumbai urban-context segments & routes
// ─────────────────────────────────────────────────────────────────────────────

const RAW_SEGMENTS: Array<Omit<SegmentSafetyProfile, 'lightingScore' | 'crossingScore' | 'footpathScore' | 'slopeScore' | 'visibilityScore' | 'totalScore'>> = [
  {
    id: 'seg-a1', name: 'Main Concourse Walkway', distanceMeters: 180,
    isLit: true, streetlampDensityPerKm: 14,
    hasTactilePaving: true, footpathSurface: 'tactile', footpathWidthCm: 200,
    hasSteps: false, stepCount: 0, maxSlopePercent: 1,
    crossingType: 'signal', hasPelicanSignal: true, hasRefugeIsland: false,
    obstacleFreeLineOfSight: true, estimatedCrowdDensity: 'moderate',
    lastAuditedAt: '2026-09-18',
  },
  {
    id: 'seg-a2', name: 'Elevator B Corridor', distanceMeters: 120,
    isLit: true, streetlampDensityPerKm: 18,
    hasTactilePaving: true, footpathSurface: 'smooth', footpathWidthCm: 180,
    hasSteps: false, stepCount: 0, maxSlopePercent: 0,
    crossingType: 'none', hasPelicanSignal: false, hasRefugeIsland: false,
    obstacleFreeLineOfSight: true, estimatedCrowdDensity: 'low',
    lastAuditedAt: '2026-09-19',
  },
  {
    id: 'seg-b1', name: 'South Ramp C Approach', distanceMeters: 210,
    isLit: true, streetlampDensityPerKm: 8,
    hasTactilePaving: false, footpathSurface: 'smooth', footpathWidthCm: 150,
    hasSteps: false, stepCount: 0, maxSlopePercent: 3.5,
    crossingType: 'zebra', hasPelicanSignal: false, hasRefugeIsland: true,
    obstacleFreeLineOfSight: true, estimatedCrowdDensity: 'low',
    lastAuditedAt: '2026-09-17',
  },
  {
    id: 'seg-b2', name: 'Service Lift Bypass Corridor', distanceMeters: 160,
    isLit: true, streetlampDensityPerKm: 10,
    hasTactilePaving: false, footpathSurface: 'unpaved', footpathWidthCm: 130,
    hasSteps: false, stepCount: 0, maxSlopePercent: 2,
    crossingType: 'zebra', hasPelicanSignal: false, hasRefugeIsland: false,
    obstacleFreeLineOfSight: true, estimatedCrowdDensity: 'moderate',
    lastAuditedAt: '2026-09-16',
  },
  {
    id: 'seg-c1', name: 'Elevated Flyover Ramp A', distanceMeters: 280,
    isLit: false, streetlampDensityPerKm: 3,
    hasTactilePaving: false, footpathSurface: 'cobblestone', footpathWidthCm: 90,
    hasSteps: true, stepCount: 4, maxSlopePercent: 9,
    crossingType: 'uncontrolled', hasPelicanSignal: false, hasRefugeIsland: false,
    obstacleFreeLineOfSight: false, estimatedCrowdDensity: 'high',
    lastAuditedAt: '2026-09-10',
  },
  {
    id: 'seg-c2', name: 'At-Grade Service Road Lane 2', distanceMeters: 200,
    isLit: false, streetlampDensityPerKm: 2,
    hasTactilePaving: false, footpathSurface: 'broken', footpathWidthCm: 80,
    hasSteps: true, stepCount: 2, maxSlopePercent: 6,
    crossingType: 'none', hasPelicanSignal: false, hasRefugeIsland: false,
    obstacleFreeLineOfSight: false, estimatedCrowdDensity: 'high',
    lastAuditedAt: '2026-09-08',
  },
];

/** Pre-scored demo segments */
const SEGMENTS = RAW_SEGMENTS.map(s => scoreSegment(s, false));

const getSegs = (...ids: string[]) => SEGMENTS.filter(s => ids.includes(s.id));

const ALL_PERSONAS: PersonaType[] = ['wheelchair', 'low-vision', 'older-adult', 'caregiver', 'none'];

function buildRoute(
  routeId: string,
  label: string,
  color: string,
  distanceMeters: number,
  estimatedMinutes: number,
  segIds: string[],
): RouteWithSafety {
  const segments = getSegs(...segIds);
  const composite = compositeScore(segments);
  const night = compositeScore(segments.map(s => scoreSegment(s, true)));
  const personaSuitability = Object.fromEntries(
    ALL_PERSONAS.map(p => [p, getPersonaSuitability({ segments }, p)])
  ) as Record<PersonaType, boolean>;

  return {
    routeId,
    label,
    color,
    distanceMeters,
    estimatedMinutes,
    segments,
    compositeSafetyScore: composite,
    safetyLabel: getSafetyLabel(composite),
    personaSuitability,
    nightSafetyScore: night,
    isRecommendedForPersona: false,
    surfaceQualityBadges: computeSurfaceQualityBadges(segments),
    filterViolations: [],
  };
}

export const DEFAULT_ROUTES: RouteWithSafety[] = [
  buildRoute('route-a', 'Central Concourse Route', 'primary', 300, 6, ['seg-a1', 'seg-a2']),
  buildRoute('route-b', 'South Ramp C & Lift 4',  'secondary', 370, 8, ['seg-b1', 'seg-b2']),
  buildRoute('route-c', 'Flyover & Service Road',  'tertiary',  480, 11, ['seg-c1', 'seg-c2']),
];

export const DEMO_ROUTES: RouteWithSafety[] = DEFAULT_ROUTES;
