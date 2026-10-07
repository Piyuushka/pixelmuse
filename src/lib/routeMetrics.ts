import { Coordinates, calculateHaversineDistance, isBarrierOnRouteSegment, decodePolyline } from './spatial';
import { IndianBarrierReport } from './barrierEngine';
import { AccessibilityPreferences, PersonaType } from '@/context/AccessibilityContext';

export type DataSourceType = 'live' | 'estimated' | 'demo';

export interface RouteCrossingMetrics {
  signalled: number;
  unsignalled: number;
}

export interface RouteScoreBreakdown {
  baseScore: number;
  stairDeduction: number;
  slopeDeduction: number;
  barrierDeduction: number;
  crossingDeduction: number;
  surfaceDeduction: number;
  lightingAdjustment: number;
  finalScore: number;
  formulaExplanation: string;
}

export interface RouteMetrics {
  distanceM: number;
  durationMin: number;
  stepCount: number;
  maxSlopePct: number;
  avgSlopePct: number;
  crossings: RouteCrossingMetrics;
  surfaceIssues: number;
  barriersOnRoute: number;
  lightingScore: number;
  accessibilityScore: number; // 0 - 100
  dataSource: DataSourceType;
  scoreBreakdown: RouteScoreBreakdown;
}

export interface RouteMetricsInput {
  distanceM?: number;
  distance_m?: number;
  durationMin?: number;
  duration_s?: number;
  stepCount?: number;
  steps?: Array<{
    title?: string;
    instruction?: string;
    maneuver?: string;
    detail?: string;
    type?: string;
    distance_m?: number;
    distance?: number;
    slopePercent?: number;
    surface?: string;
    isLit?: boolean;
    start?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
    end?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
    location?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
  }>;
  encodedPolyline?: string;
  coordinates?: Coordinates[];
  slopeData?: {
    maxSlopePct?: number;
    avgSlopePct?: number;
  };
  surfaceData?: {
    surfaceIssues?: number;
  };
  crossingsData?: {
    signalled?: number;
    unsignalled?: number;
  };
  stairsCount?: number;
  lightingScore?: number;
  dataSource?: DataSourceType;
}

/**
 * =============================================================================
 * ACCESSIBILITY SCORE FORMULA DOCUMENTATION (0 - 100)
 * =============================================================================
 *
 * Base Score: 100 Points
 *
 * Deductions & Adjustments:
 * 1. Stairs Deduction:
 *    - Wheelchair / Caregiver Persona: -40 pts per stair flight encountered.
 *      (Stairs are impassable or dangerous obstacles for wheeled transport).
 *    - Older Adult: -20 pts per stair flight.
 *    - Low Vision: -15 pts per stair flight.
 *    - Standard / None: -5 pts per stair flight.
 *
 * 2. Slope Deduction:
 *    - Max Slope Exceedance: For every 1% that maxSlopePct exceeds the profile's
 *      configured maxSlopePercent threshold (default 5% for wheelchair, 8% older adult),
 *      deduct 6 pts.
 *    - Incline Strain: For every 1% of average slope above 3%, deduct 1.5 pts.
 *
 * 3. Barrier Deduction:
 *    - Active barrier lying directly within 30m corridor of the route:
 *      - Critical severity or Complete blockage: -40 pts per incident.
 *      - High / Medium severity (potholes, debris, scaffolding): -25 pts per incident.
 *      - Low severity: -12 pts per incident.
 *
 * 4. Crossing Quality Deduction:
 *    - Unsignalled multi-lane / arterial crossings:
 *      - Low Vision & Wheelchair: -12 pts per unsignalled crossing.
 *      - Older Adult: -8 pts per unsignalled crossing.
 *      - Other: -4 pts per unsignalled crossing.
 *    - Signalized / Audible crossings bonus: +2 pts per crossing (up to +6 pts).
 *
 * 5. Surface Integrity Deduction:
 *    - Broken paving, cobblestones, mud, or unpaved sections: -8 pts per issue.
 *
 * 6. Lighting Adjustment:
 *    - Below 50/100 lighting score: up to -10 pts deduction for night/low-vision hazard.
 *    - Above 80/100 lighting score: +3 pts well-lit bonus.
 *
 * Final Score = Clamp(100 - (stairDed + slopeDed + barrierDed + crossDed + surfDed) + lightingAdj, 0, 100)
 * =============================================================================
 */

export const ACCESSIBILITY_SCORE_FORMULA_DOC = `Base Score: 100. Deductions: Stairs (-40 for wheelchair, -20 for older adult), Slope exceedance (-6 per 1% above profile max slope), Confirmed route barriers (-25 to -40 per barrier), Uncontrolled crossings (-8 to -12 per crossing), Surface defects (-8 per broken/cobblestone issue), and Lighting penalty (-10 for dark paths). Result is clamped between 0 and 100.`;

/**
 * Normalizes an arbitrary profile input into an AccessibilityPreferences object.
 */
export function resolveProfilePreferences(
  profile?: PersonaType | AccessibilityPreferences | string
): AccessibilityPreferences {
  if (typeof profile === 'object' && profile !== null && 'maxSlopePercent' in profile) {
    return profile as AccessibilityPreferences;
  }

  const persona = (typeof profile === 'string' ? profile : 'wheelchair') as PersonaType;

  switch (persona) {
    case 'wheelchair':
      return {
        primaryPersona: 'wheelchair',
        mobilityType: 'electric-wheelchair',
        requireStepFree: true,
        maxSlopePercent: 5,
        preferLowerSlopes: true,
        preferReducedDistance: true,
        preferSaferCrossings: true,
        avoidStairs: true,
        needTactilePaving: false,
        needAudioPrompts: true,
        maxWalkingDistanceMeters: 2000,
      };
    case 'older-adult':
      return {
        primaryPersona: 'older-adult',
        mobilityType: 'walking-assisted',
        requireStepFree: false,
        maxSlopePercent: 8,
        preferLowerSlopes: true,
        preferReducedDistance: true,
        preferSaferCrossings: true,
        avoidStairs: true,
        needTactilePaving: false,
        needAudioPrompts: true,
        maxWalkingDistanceMeters: 1200,
      };
    case 'low-vision':
      return {
        primaryPersona: 'low-vision',
        mobilityType: 'white-cane',
        requireStepFree: false,
        maxSlopePercent: 10,
        preferLowerSlopes: false,
        preferReducedDistance: false,
        preferSaferCrossings: true,
        avoidStairs: false,
        needTactilePaving: true,
        needAudioPrompts: true,
        maxWalkingDistanceMeters: 2500,
      };
    case 'caregiver':
      return {
        primaryPersona: 'caregiver',
        mobilityType: 'stroller-wheelchair',
        requireStepFree: true,
        maxSlopePercent: 6,
        preferLowerSlopes: true,
        preferReducedDistance: true,
        preferSaferCrossings: true,
        avoidStairs: true,
        needTactilePaving: false,
        needAudioPrompts: false,
        maxWalkingDistanceMeters: 3000,
      };
    case 'none':
    default:
      return {
        primaryPersona: 'none',
        mobilityType: 'standard-walking',
        requireStepFree: false,
        maxSlopePercent: 15,
        preferLowerSlopes: false,
        preferReducedDistance: false,
        preferSaferCrossings: false,
        avoidStairs: false,
        needTactilePaving: false,
        needAudioPrompts: false,
        maxWalkingDistanceMeters: 10000,
      };
  }
}

/**
 * Computes deterministic accessibility metrics for any route given a mobility profile and active barriers.
 */
export function computeRouteMetrics(
  route: RouteMetricsInput,
  profile?: PersonaType | AccessibilityPreferences | string,
  barriers: IndianBarrierReport[] = []
): RouteMetrics {
  const prefs = resolveProfilePreferences(profile);
  const persona = prefs.primaryPersona;

  // 1. Distance & Duration
  const distanceM = Math.round(
    route.distanceM ??
    route.distance_m ??
    (route.steps?.reduce((acc, s) => acc + (s.distance_m || s.distance || 0), 0) || 1000)
  );

  const durationMin = Math.max(
    1,
    route.durationMin ??
    (route.duration_s ? Math.round(route.duration_s / 60) : Math.round(distanceM / 80))
  );

  // Pedestrian step count (~0.75m per average foot step)
  const stepCount = route.stepCount ?? Math.round(distanceM / 0.75);

  // 2. Decode coordinates if polyline is present for spatial intersection
  let routeCoords: Coordinates[] = route.coordinates || [];
  if (routeCoords.length === 0 && route.encodedPolyline) {
    try {
      routeCoords = decodePolyline(route.encodedPolyline);
    } catch {
      routeCoords = [];
    }
  }

  // 3. Inspect Steps & Characteristics
  const steps = route.steps || [];
  let detectedStairs = route.stairsCount ?? 0;
  let signalledCrossings = route.crossingsData?.signalled ?? 0;
  let unsignalledCrossings = route.crossingsData?.unsignalled ?? 0;
  let surfaceIssues = route.surfaceData?.surfaceIssues ?? 0;
  let highestStepSlope = 0;
  let totalStepSlope = 0;
  let slopeStepCount = 0;

  for (const s of steps) {
    const text = `${s.title || ''} ${s.instruction || ''} ${s.detail || ''} ${s.type || ''}`.toLowerCase();

    // Check for stairs
    if (
      s.type === 'stair' ||
      text.includes('stair') ||
      text.includes('footbridge') ||
      text.includes('steps without ramp') ||
      text.includes('overbridge') ||
      text.includes('skywalk stairs')
    ) {
      if (!route.stairsCount) {
        detectedStairs += 1;
      }
    }

    // Check for crossings
    if (s.type === 'accessible_crossing' || text.includes('pelican') || text.includes('traffic light') || text.includes('signalized') || text.includes('audible signal') || text.includes('zebra crossing')) {
      if (!route.crossingsData) signalledCrossings += 1;
    } else if (s.type === 'unsafe_crossing' || text.includes('unsignalized') || text.includes('multi-lane') || text.includes('chaotic') || text.includes('arterial crossing') || text.includes('no pedestrian phase') || text.includes('cross the street')) {
      if (!route.crossingsData) unsignalledCrossings += 1;
    }

    // Check for surface defects
    if (
      text.includes('broken') ||
      text.includes('pothole') ||
      text.includes('cobblestone') ||
      text.includes('mud') ||
      text.includes('gravel') ||
      text.includes('debris') ||
      text.includes('missing curb') ||
      text.includes('uneven')
    ) {
      if (!route.surfaceData) surfaceIssues += 1;
    }

    // Slope detection from steps
    if (typeof s.slopePercent === 'number') {
      highestStepSlope = Math.max(highestStepSlope, s.slopePercent);
      totalStepSlope += s.slopePercent;
      slopeStepCount++;
    } else if (text.includes('steep') || text.includes('10%') || text.includes('11%')) {
      highestStepSlope = Math.max(highestStepSlope, 10);
    } else if (text.includes('ramp') || text.includes('4%') || text.includes('5%')) {
      highestStepSlope = Math.max(highestStepSlope, 4);
    }
  }

  // 4. Slope calculation (Live ORS / Google Elevation, or estimated from steps / benchmark)
  let maxSlopePct = route.slopeData?.maxSlopePct ?? highestStepSlope;
  let avgSlopePct = route.slopeData?.avgSlopePct ?? (slopeStepCount > 0 ? Number((totalStepSlope / slopeStepCount).toFixed(1)) : 2.5);

  if (maxSlopePct === 0) {
    if (detectedStairs > 0) {
      maxSlopePct = 10;
      avgSlopePct = 4.5;
    } else if (persona === 'wheelchair') {
      maxSlopePct = 4.0;
      avgSlopePct = 2.0;
    } else {
      maxSlopePct = 6.0;
      avgSlopePct = 3.0;
    }
  }

  // 5. Barriers on route spatial intersection
  let barriersOnRoute = 0;
  let criticalBarrierCount = 0;

  const activeBarriers = barriers.filter(b => !b.isExpired && b.status !== 'Expired' && b.status !== 'Resolved');

  if (routeCoords.length > 1 && activeBarriers.length > 0) {
    for (const barrier of activeBarriers) {
      if (isBarrierOnRouteSegment(barrier.coordinates, routeCoords, 30)) {
        barriersOnRoute += 1;
        if (barrier.severity === 'critical' || barrier.category.toLowerCase().includes('blocked')) {
          criticalBarrierCount += 1;
        }
      }
    }
  } else if (steps.some(s => s.type === 'barrier' || (s.detail && s.detail.toLowerCase().includes('barrier')))) {
    barriersOnRoute = steps.filter(s => s.type === 'barrier' || (s.detail && s.detail.toLowerCase().includes('barrier'))).length;
  }

  // 6. Lighting score (0 - 100)
  const lightingScore = route.lightingScore ?? (
    steps.some(s => (s.instruction || '').toLowerCase().includes('unlit') || (s.detail || '').toLowerCase().includes('dark'))
      ? 45
      : 85
  );

  // 7. Calculate Accessibility Score Deductions
  // Stair deduction based on persona sensitivity
  let stairPenaltyMultiplier = 5;
  if (persona === 'wheelchair' || persona === 'caregiver' || prefs.requireStepFree) {
    stairPenaltyMultiplier = 40;
  } else if (persona === 'older-adult') {
    stairPenaltyMultiplier = 20;
  } else if (persona === 'low-vision') {
    stairPenaltyMultiplier = 15;
  } else if (prefs.avoidStairs) {
    stairPenaltyMultiplier = 15;
  }
  const stairDeduction = detectedStairs * stairPenaltyMultiplier;

  // Slope deduction
  const allowedSlope = prefs.maxSlopePercent || 8;
  const excessSlope = Math.max(0, maxSlopePct - allowedSlope);
  const slopeDeduction = Math.round(excessSlope * 6 + Math.max(0, avgSlopePct - 3) * 1.5);

  // Barrier deduction
  const standardBarriers = Math.max(0, barriersOnRoute - criticalBarrierCount);
  const barrierDeduction = criticalBarrierCount * 40 + standardBarriers * 25;

  // Crossing deduction
  let crossingMultiplier = 4;
  if (persona === 'wheelchair' || persona === 'low-vision') {
    crossingMultiplier = 12;
  } else if (persona === 'older-adult') {
    crossingMultiplier = 8;
  } else if (prefs.preferSaferCrossings) {
    crossingMultiplier = 8;
  }
  const crossingDeduction = Math.max(0, unsignalledCrossings * crossingMultiplier - Math.min(6, signalledCrossings * 2));

  // Surface deduction
  const surfaceDeduction = surfaceIssues * 8;

  // Lighting impact
  let lightingAdjustment = 0;
  if (lightingScore < 50) {
    lightingAdjustment = -10;
  } else if (lightingScore >= 80) {
    lightingAdjustment = 3;
  }

  // Final accessibility score
  const totalDeductions = stairDeduction + slopeDeduction + barrierDeduction + crossingDeduction + surfaceDeduction;
  const rawScore = 100 - totalDeductions + lightingAdjustment;
  const accessibilityScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Determine data source
  const dataSource: DataSourceType = route.dataSource || (
    route.slopeData ? 'live' : (route.encodedPolyline ? 'estimated' : 'demo')
  );

  return {
    distanceM,
    durationMin,
    stepCount,
    maxSlopePct: Number(maxSlopePct.toFixed(1)),
    avgSlopePct: Number(avgSlopePct.toFixed(1)),
    crossings: {
      signalled: signalledCrossings,
      unsignalled: unsignalledCrossings,
    },
    surfaceIssues,
    barriersOnRoute,
    lightingScore,
    accessibilityScore,
    dataSource,
    scoreBreakdown: {
      baseScore: 100,
      stairDeduction,
      slopeDeduction,
      barrierDeduction,
      crossingDeduction,
      surfaceDeduction,
      lightingAdjustment,
      finalScore: accessibilityScore,
      formulaExplanation: ACCESSIBILITY_SCORE_FORMULA_DOC,
    },
  };
}
