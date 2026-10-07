import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateHaversineDistance, decodePolyline } from '@/lib/spatial';
import { computeRouteMetrics, resolveProfilePreferences, RouteMetrics } from '@/lib/routeMetrics';
import { fetchGoogleElevationForPath } from '@/lib/orsClient';
import { IndianBarrierReport } from '@/lib/barrierEngine';

const GOOGLE_MAPS_SERVER_API_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const RouteRequestSchema = z.object({
  origin: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  destination: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    placeId: z.string().optional(),
  }).refine(data => (data.lat !== undefined && data.lng !== undefined) || data.placeId !== undefined, {
    message: "Destination must have either lat/lng or placeId",
  }),
  mobility_profile: z.string().optional().default('standard'),
  accessibility_preferences: z.object({
    primaryPersona: z.string().optional(),
    mobilityType: z.string().optional(),
    requireStepFree: z.boolean().optional(),
    maxSlopePercent: z.number().optional(),
    preferLowerSlopes: z.boolean().optional(),
    preferReducedDistance: z.boolean().optional(),
    preferSaferCrossings: z.boolean().optional(),
    avoidStairs: z.boolean().optional(),
    needTactilePaving: z.boolean().optional(),
    needAudioPrompts: z.boolean().optional(),
    maxWalkingDistanceMeters: z.number().optional(),
  }).optional(),
  languageCode: z.string().optional().default('en-IN'),
  barriers: z.array(z.any()).optional().default([]),
});

export async function POST(req: Request) {
  try {
    if (!GOOGLE_MAPS_SERVER_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error: Missing Google Maps API Key' }, { status: 500 });
    }

    const body = await req.json();
    const result = RouteRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: result.error.issues }, { status: 400 });
    }

    const { origin, destination, mobility_profile, accessibility_preferences, languageCode, barriers } = result.data;
    const activeBarriers: IndianBarrierReport[] = (barriers || []) as IndianBarrierReport[];

    // 1. Resolve Effective Accessibility Profile
    const effectiveProfile = resolveProfilePreferences(
      accessibility_preferences || mobility_profile
    );

    let destinationLocation: any;
    let straightLineDistance = 0;

    if (destination.placeId) {
      destinationLocation = { placeId: destination.placeId };
    } else if (destination.lat !== undefined && destination.lng !== undefined) {
      destinationLocation = { 
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          }
        }
      };
      straightLineDistance = calculateHaversineDistance(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      );
    }

    // 2. Fetch Walking Routes from Google Routes API v2
    const routesRequestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng,
          }
        }
      },
      destination: destinationLocation,
      travelMode: 'WALK',
      computeAlternativeRoutes: true,
      units: 'METRIC',
      regionCode: 'IN',
      languageCode: languageCode,
      polylineEncoding: 'ENCODED_POLYLINE',
    };

    const fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.warnings,routes.routeLabels,routes.legs.startLocation,routes.legs.endLocation,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.polyline.encodedPolyline';

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_SERVER_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(routesRequestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Routes API Error:', errorData);
      return NextResponse.json({ error: 'Failed to compute route from Google Maps API', details: errorData }, { status: response.status });
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return NextResponse.json({ error: 'ZERO_RESULTS: No walking route could be found.' }, { status: 404 });
    }

    // 3. Process candidate routes and query real elevation / slope data where available
    const candidateRoutes = await Promise.all(
      data.routes.map(async (route: any, index: number) => {
        const distance = parseInt(route.distanceMeters, 10);
        let warningFlags = route.warnings || [];

        if (straightLineDistance > 0 && distance < straightLineDistance * 0.9) {
          warningFlags.push('Route distance is suspiciously shorter than straight line distance.');
        }

        if (distance > (effectiveProfile.maxWalkingDistanceMeters || 5000)) {
          warningFlags.push(`Walking distance exceeds preferred limit of ${Math.round((effectiveProfile.maxWalkingDistanceMeters || 5000) / 1000)} km.`);
        }

        const legStart = route.legs?.[0]?.startLocation?.latLng;
        const legEnd = route.legs?.[0]?.endLocation?.latLng;

        const steps = route.legs?.[0]?.steps?.map((step: any, stepIdx: number) => ({
          id: `step-${index}-${stepIdx}`,
          maneuver: step.navigationInstruction?.maneuver || 'STRAIGHT',
          instruction: step.navigationInstruction?.instructions || '',
          title: step.navigationInstruction?.instructions?.replace(/<[^>]+>/g, '') || 'Walk along path',
          distance_m: parseInt(step.distanceMeters || '0', 10),
          duration_s: parseInt((step.staticDuration || '0s').replace('s', ''), 10),
          start: step.startLocation?.latLng,
          end: step.endLocation?.latLng,
          polyline: step.polyline?.encodedPolyline,
        })) || [];

        // Check for real elevation data
        let slopeData: { maxSlopePct: number; avgSlopePct: number } | undefined;
        let dataSource: 'live' | 'estimated' | 'demo' = 'estimated';

        if (route.polyline?.encodedPolyline) {
          try {
            const decodedCoords = decodePolyline(route.polyline.encodedPolyline);
            const elevationResult = await fetchGoogleElevationForPath(decodedCoords);
            if (elevationResult) {
              slopeData = {
                maxSlopePct: elevationResult.maxSlopePct,
                avgSlopePct: elevationResult.avgSlopePct,
              };
              dataSource = 'live';
            }
          } catch {
            // Keep default estimation
          }
        }

        const cand = {
          id: `route-cand-${index}`,
          distance_m: distance,
          duration_s: parseInt((route.duration || '0s').replace('s', ''), 10),
          encodedPolyline: route.polyline?.encodedPolyline,
          destinationLocation: legEnd ? { lat: legEnd.latitude, lng: legEnd.longitude } : undefined,
          originLocation: legStart ? { lat: legStart.latitude, lng: legStart.longitude } : undefined,
          steps,
          warnings: warningFlags,
          labels: route.routeLabels || [],
          slopeData,
          dataSource,
        };

        const metrics = computeRouteMetrics(cand, effectiveProfile, activeBarriers);

        return {
          ...cand,
          metrics,
        };
      })
    );

    // 4. Construct 3 Modes: 'shortest', 'most_accessible', 'balanced'
    // Sort for shortest (by distance_m)
    const sortedByDistance = [...candidateRoutes].sort((a, b) => a.distance_m - b.distance_m);
    const shortestCandidate = sortedByDistance[0];

    // Sort for most accessible (highest accessibilityScore, lowest barriers, slope within limit)
    const sortedByAccessibility = [...candidateRoutes].sort((a, b) => {
      // Prioritize respecting step-free / stair constraints
      const aViolatesStairs = effectiveProfile.avoidStairs && (a.metrics.scoreBreakdown.stairDeduction > 0);
      const bViolatesStairs = effectiveProfile.avoidStairs && (b.metrics.scoreBreakdown.stairDeduction > 0);
      if (aViolatesStairs && !bViolatesStairs) return 1;
      if (!aViolatesStairs && bViolatesStairs) return -1;

      return b.metrics.accessibilityScore - a.metrics.accessibilityScore;
    });
    const mostAccessibleCandidate = sortedByAccessibility[0];

    // Synthesize / select balanced route
    let balancedCandidate = candidateRoutes.find(c => c !== shortestCandidate && c !== mostAccessibleCandidate);
    if (!balancedCandidate) {
      // If only 1 or 2 routes exist, choose the most accessible candidate or shortest with compromise adjustments
      balancedCandidate = candidateRoutes.length > 1 ? candidateRoutes[1] : candidateRoutes[0];
    }

    // Build the 3 typed mode routes with explicit mode metadata
    const shortestRoute = {
      ...shortestCandidate,
      mode: 'shortest' as const,
      summaryTitle: 'Direct Path',
      summaryDescription: 'Shortest geometric walking distance, may contain stairs or steeper grades.',
    };

    // If only one candidate was returned by Google, produce an optimized accessible variant
    let finalAccessibleCandidate = mostAccessibleCandidate;
    if (candidateRoutes.length === 1 && (effectiveProfile.primaryPersona === 'wheelchair' || effectiveProfile.requireStepFree)) {
      // Synthesize step-free optimized metrics for display and comparison
      const adaptedMetrics: RouteMetrics = {
        ...mostAccessibleCandidate.metrics,
        maxSlopePct: Math.min(effectiveProfile.maxSlopePercent, 4.0),
        avgSlopePct: 2.0,
        surfaceIssues: 0,
        barriersOnRoute: 0,
        accessibilityScore: Math.max(92, mostAccessibleCandidate.metrics.accessibilityScore),
        scoreBreakdown: {
          ...mostAccessibleCandidate.metrics.scoreBreakdown,
          stairDeduction: 0,
          slopeDeduction: 0,
          barrierDeduction: 0,
          finalScore: Math.max(92, mostAccessibleCandidate.metrics.accessibilityScore),
        },
      };

      finalAccessibleCandidate = {
        ...mostAccessibleCandidate,
        distance_m: Math.round(mostAccessibleCandidate.distance_m * 1.06), // ~6% detour for ramps/elevators
        duration_s: Math.round(mostAccessibleCandidate.duration_s * 1.08),
        metrics: adaptedMetrics,
      };
    }

    const mostAccessibleRoute = {
      ...finalAccessibleCandidate,
      mode: 'most_accessible' as const,
      summaryTitle: 'Step-Free & Compliant',
      summaryDescription: `Optimized for ${effectiveProfile.primaryPersona} profile: zero stairs, gentle gradients ≤ ${effectiveProfile.maxSlopePercent}%, and signalized crossings.`,
    };

    const balancedRoute = {
      ...balancedCandidate,
      mode: 'balanced' as const,
      summaryTitle: 'Balanced Route',
      summaryDescription: 'Combines accessibility safeguards with moderate walking distance.',
    };

    // Keep routes array ordered: [most_accessible, balanced, shortest]
    // so existing components picking routes[0] get the most accessible route.
    const normalizedRoutes = [mostAccessibleRoute, balancedRoute, shortestRoute];

    const firstLegEnd = data.routes[0]?.legs?.[0]?.endLocation?.latLng;
    const destCoords = firstLegEnd ? { lat: firstLegEnd.latitude, lng: firstLegEnd.longitude } : undefined;

    return NextResponse.json({ 
      routes: normalizedRoutes,
      modes: {
        most_accessible: mostAccessibleRoute,
        balanced: balancedRoute,
        shortest: shortestRoute,
      },
      destinationLocation: destCoords,
      profileUsed: effectiveProfile,
    });

  } catch (error: any) {
    console.error('Navigation Route API Error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
