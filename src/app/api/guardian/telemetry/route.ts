import { NextRequest, NextResponse } from 'next/server';
import {
  findUserByEmail,
  getActiveTrip,
  startTrip,
  updateTripPing,
} from '@/lib/db/userStore';
import { analyseGpsPing } from '@/lib/guardianAnomalyEngine';
import {
  guardianBroadcaster,
  buildLocationEvent,
  buildDeviationEvent,
  buildStopEvent,
  buildTripStartedEvent,
  GuardianLocationPayload,
} from '@/lib/guardianBroadcaster';

/**
 * POST /api/guardian/telemetry
 *
 * Receives a GPS ping from a dependent's active navigation session.
 * Performs the following in sequence:
 *  1. Validates the user and their privacy settings.
 *  2. Starts a new Trip record if none is ACTIVE (or uses the provided tripId).
 *  3. Updates the trip with the new coordinates.
 *  4. Runs ROUTE_DEVIATION + PROLONGED_STOP anomaly detection.
 *  5. Emits appropriate events via guardianBroadcaster → connected SSE clients.
 *
 * Body: {
 *   userEmail: string,
 *   coords: { lat: number, lng: number },
 *   routeGeometry?: Array<{ lat: number, lng: number }>,
 *   origin?: string,
 *   destination?: string,
 *   tripId?: string   // if omitted, picks up the current ACTIVE trip or starts one
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userEmail, coords, routeGeometry, origin, destination, tripId: incomingTripId } = body;

    if (!userEmail || !coords?.lat || !coords?.lng) {
      return NextResponse.json(
        { error: 'userEmail and coords (lat, lng) are required.' },
        { status: 400 }
      );
    }

    const user = findUserByEmail(userEmail);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Privacy gate — respect user's sharing preference
    const privacySettings = user.privacySettings;
    if (privacySettings && !privacySettings.allowRealtimeLocation) {
      return NextResponse.json(
        { error: 'User has disabled real-time location sharing.' },
        { status: 403 }
      );
    }

    // Resolve or create active trip
    let activeTrip = getActiveTrip(userEmail);
    let isNewTrip = false;

    if (!activeTrip) {
      if (!origin || !destination) {
        return NextResponse.json(
          { error: 'origin and destination are required to start a new trip.' },
          { status: 400 }
        );
      }
      activeTrip = startTrip(userEmail, origin, destination, routeGeometry || []);
      isNewTrip = true;
    }

    // Update trip with latest ping
    const updatedTrip = updateTripPing(activeTrip.id, coords);

    // Build base payload for events
    const basePayload: GuardianLocationPayload = {
      coords,
      tripId: updatedTrip.id,
      origin: updatedTrip.origin,
      destination: updatedTrip.destination,
      tripStatus: updatedTrip.status,
      startTime: updatedTrip.startTime,
      lastPingAt: updatedTrip.lastPingAt || new Date().toISOString(),
      routeGeometry: updatedTrip.routeGeometry,
    };

    const emittedEvents: string[] = [];

    // Emit TRIP_STARTED event if this is a new trip
    if (isNewTrip) {
      guardianBroadcaster.emitToGuardians(
        userEmail,
        buildTripStartedEvent(user.email, user.name, basePayload)
      );
      emittedEvents.push('TRIP_STARTED');
    }

    // Always emit LOCATION_UPDATE
    guardianBroadcaster.emitToGuardians(
      userEmail,
      buildLocationEvent(user.email, user.name, basePayload)
    );
    emittedEvents.push('LOCATION_UPDATE');

    // Run anomaly detection
    const { anomalies, deviation, stop } = analyseGpsPing(coords, updatedTrip);

    if (anomalies.includes('ROUTE_DEVIATION')) {
      guardianBroadcaster.emitToGuardians(
        userEmail,
        buildDeviationEvent(user.email, user.name, {
          ...basePayload,
          distanceMeters: deviation.distanceMeters,
          nearestRoutePoint: deviation.nearestRoutePoint,
        })
      );
      emittedEvents.push('ROUTE_DEVIATION');
    }

    if (anomalies.includes('PROLONGED_STOP')) {
      guardianBroadcaster.emitToGuardians(
        userEmail,
        buildStopEvent(user.email, user.name, {
          ...basePayload,
          stopDurationMs: stop.stopDurationMs,
          staticSince: stop.staticSince,
        })
      );
      emittedEvents.push('PROLONGED_STOP');
    }

    return NextResponse.json({
      success: true,
      tripId: updatedTrip.id,
      anomaliesDetected: anomalies,
      eventsEmitted: emittedEvents,
      deviation: deviation.isDeviated ? deviation : null,
      stop: stop.isStopped ? stop : null,
    });
  } catch (err: any) {
    console.error('[/api/guardian/telemetry] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Telemetry processing failed.' },
      { status: 500 }
    );
  }
}
