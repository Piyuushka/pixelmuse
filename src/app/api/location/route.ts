import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/db/userStore';
import { locationBroadcaster } from '@/lib/locationBroadcaster';
import { guardianBroadcaster } from '@/lib/guardianBroadcaster';
import { locationPingSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const user = findUserById(session.userId);
    if (!user) {
      return apiError('User not found', 'NOT_FOUND', 404);
    }

    const body = await request.json();
    const validated = locationPingSchema.parse(body);

    const points = 'locations' in validated ? validated.locations : [validated];
    const now = new Date().toISOString();

    for (const pt of points) {
      // Validate recorded_at timestamp (must not be more than 2 minutes in future or 24 hours in past)
      const recordedTime = new Date(pt.recorded_at).getTime();
      const nowTime = Date.now();
      if (recordedTime > nowTime + 2 * 60 * 1000) {
        return apiError('Timestamp cannot be in the future', 'INVALID_TIMESTAMP', 400);
      }

      // Publish to in-memory broadcaster & Realtime
      locationBroadcaster.publishLocation({
        userId: user.id,
        userEmail: user.email,
        name: user.name,
        lat: pt.lat,
        lng: pt.lng,
        accuracy: pt.accuracy_m,
        speed: pt.speed,
        heading: pt.heading,
        batteryLevel: pt.battery_pct,
        timestamp: pt.recorded_at || now,
      });

      // Emit to guardian telemetry
      guardianBroadcaster.emitToGuardians(user.email, {
        id: `ge_${Date.now()}`,
        type: 'LOCATION_UPDATE',
        dependentEmail: user.email,
        dependentName: user.name,
        timestamp: pt.recorded_at || now,
        payload: {
          coords: { lat: pt.lat, lng: pt.lng },
          tripId: user.activeTrip?.tripId || 'live_stream',
          origin: user.activeTrip?.source || 'Start',
          destination: user.activeTrip?.destination || 'Destination',
          tripStatus: user.activeTrip?.status || 'IN_PROGRESS',
          startTime: user.activeTrip?.startedAt || now,
          lastPingAt: now,
        },
        message: `${user.name} location updated.`,
      });

      // Update active trip coords in store
      if (user.activeTrip) {
        user.activeTrip.currentCoords = { lat: pt.lat, lng: pt.lng };
        updateUser(user.id, { activeTrip: user.activeTrip });
      }
    }

    return apiSuccess({
      success: true,
      processedPoints: points.length,
      timestamp: now,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
