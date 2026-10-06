import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/db/userStore';
import { recordLocationPing } from '@/lib/locationCache';
import { guardianBroadcaster } from '@/lib/guardianBroadcaster';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lat, lng, accuracy = 5, battery = 100, speed = 0, heading = 0 } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ success: false, error: 'Invalid latitude and longitude' }, { status: 400 });
    }

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // 1. Record in LocationCache ring buffer
    const pingData = {
      userId: user.id,
      userEmail: user.email,
      lat,
      lng,
      accuracy,
      battery,
      speed,
      heading,
      timestamp: now,
    };
    recordLocationPing(pingData);

    // 2. Update user's active trip coordinates if present
    if (user.activeTrip) {
      const updatedActiveTrip = {
        ...user.activeTrip,
        currentCoords: { lat, lng },
      };
      updateUser(user.id, { activeTrip: updatedActiveTrip });
    }

    // 3. Broadcast via SSE to paired caregivers
    guardianBroadcaster.emitToGuardians(user.email, {
      id: `evt_${Date.now()}`,
      type: 'LOCATION_UPDATE',
      dependentEmail: user.email,
      dependentName: user.name,
      timestamp: now,
      payload: {
        coords: { lat, lng },
        tripId: user.activeTrip?.tripId || 'live_stream',
        origin: user.activeTrip?.source || 'Current Location',
        destination: user.activeTrip?.destination || 'Destination',
        tripStatus: user.activeTrip?.status || 'IN_PROGRESS',
        startTime: user.activeTrip?.startedAt || now,
        lastPingAt: now,
        battery,
        accuracy,
        speed,
      } as any,
      message: `${user.name} location updated (battery: ${battery}%, accuracy: ±${accuracy}m)`,
    });

    return NextResponse.json({
      success: true,
      message: 'Location ping received',
      timestamp: now,
    });
  } catch (error: any) {
    console.error('Location ping error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process location ping' }, { status: 500 });
  }
}
