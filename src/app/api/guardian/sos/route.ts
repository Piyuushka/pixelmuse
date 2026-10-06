import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, endTrip, getActiveTrip } from '@/lib/db/userStore';
import { guardianBroadcaster, buildSosEvent, buildTripEndedEvent } from '@/lib/guardianBroadcaster';

/**
 * POST /api/guardian/sos
 *
 * Handles a panic button press from a dependent.
 * Actions (all happen synchronously before responding):
 *  1. Validates the user.
 *  2. If there is an ACTIVE trip, marks it as SOS status.
 *  3. Instantly emits SOS_TRIGGER to all ACCEPTED guardians via guardianBroadcaster.
 *  4. Emits TRIP_ENDED event so guardians know the trip context.
 *
 * Body: {
 *   userEmail: string,
 *   coords: { lat: number, lng: number },
 *   tripId?: string   // optional — falls back to current ACTIVE trip
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userEmail, coords, tripId: incomingTripId } = body;

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

    const triggeredAt = new Date().toISOString();

    // Resolve active trip
    let activeTrip = getActiveTrip(userEmail);
    let tripId = incomingTripId || activeTrip?.id;
    let destination = activeTrip?.destination;

    // Mark trip as SOS if one is active
    if (tripId) {
      try {
        const sosTrip = endTrip(tripId, 'SOS');
        destination = sosTrip.destination;
      } catch {
        // Trip might already be ended — non-fatal
      }
    }

    // Emit SOS_TRIGGER — highest-priority event, no privacy gate
    const sosEvent = buildSosEvent(user.email, user.name, {
      coords,
      triggeredAt,
      tripId,
      destination,
    });
    guardianBroadcaster.emitToGuardians(userEmail, sosEvent);

    // Emit TRIP_ENDED (SOS context) so dashboard can update trip status
    if (destination) {
      const tripEndedEvent = buildTripEndedEvent(user.email, user.name, 'SOS', destination);
      guardianBroadcaster.emitToGuardians(userEmail, tripEndedEvent);
    }

    return NextResponse.json({
      success: true,
      message: 'SOS alert dispatched to all active guardians.',
      triggeredAt,
      tripId,
    });
  } catch (err: any) {
    console.error('[/api/guardian/sos] Error:', err);
    return NextResponse.json(
      { error: err.message || 'SOS processing failed.' },
      { status: 500 }
    );
  }
}
