import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateHaversineDistance } from '@/lib/spatial';

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
  languageCode: z.string().optional().default('en-IN'),
});

export async function POST(req: Request) {
  try {
    // TODO: Add rate limiting and authentication check here
    
    if (!GOOGLE_MAPS_SERVER_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error: Missing Google Maps API Key' }, { status: 500 });
    }

    const body = await req.json();
    const result = RouteRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: result.error.issues }, { status: 400 });
    }

    const { origin, destination, languageCode } = result.data;

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

    const normalizedRoutes = data.routes.map((route: any) => {
      const distance = parseInt(route.distanceMeters, 10);
      let warningFlags = route.warnings || [];
      
      // Check distance against straight line
      if (straightLineDistance > 0 && distance < straightLineDistance * 0.9) {
        warningFlags.push('Route distance is suspiciously shorter than straight line distance.');
      }
      
      if (distance > 5000) {
        warningFlags.push('Walking distance is over 5 km. Consider using Drive or Transit modes.');
      }

      const legStart = route.legs?.[0]?.startLocation?.latLng;
      const legEnd = route.legs?.[0]?.endLocation?.latLng;

      const steps = route.legs?.[0]?.steps?.map((step: any) => ({
        maneuver: step.navigationInstruction?.maneuver || 'STRAIGHT',
        instruction: step.navigationInstruction?.instructions || '',
        distance_m: parseInt(step.distanceMeters || '0', 10),
        duration_s: parseInt((step.staticDuration || '0s').replace('s', ''), 10),
        start: step.startLocation?.latLng,
        end: step.endLocation?.latLng,
        polyline: step.polyline?.encodedPolyline,
      })) || [];

      return {
        distance_m: distance,
        duration_s: parseInt((route.duration || '0s').replace('s', ''), 10),
        encodedPolyline: route.polyline?.encodedPolyline,
        destinationLocation: legEnd ? { lat: legEnd.latitude, lng: legEnd.longitude } : undefined,
        originLocation: legStart ? { lat: legStart.latitude, lng: legStart.longitude } : undefined,
        steps,
        warnings: warningFlags,
        labels: route.routeLabels || [],
      };
    });

    const firstLegEnd = data.routes[0]?.legs?.[0]?.endLocation?.latLng;
    const destCoords = firstLegEnd ? { lat: firstLegEnd.latitude, lng: firstLegEnd.longitude } : undefined;

    return NextResponse.json({ 
      routes: normalizedRoutes,
      destinationLocation: destCoords
    });

  } catch (error: any) {
    console.error('Navigation Route API Error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
