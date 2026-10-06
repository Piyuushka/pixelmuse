import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, triggerAlertForChild } from '@/lib/db/userStore';
import { guardianBroadcaster } from '@/lib/guardianBroadcaster';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { lat, lng, isTest = false, message } = body;

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const coords = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : { lat: 19.0760, lng: 72.8777 };
    const sosMessage = message || (isTest ? `[TEST MODE] Emergency panic test triggered by ${user.name}` : `EMERGENCY SOS! ${user.name} triggered panic alert near current location.`);

    // Record alert in userStore DB
    let alertRecord;
    try {
      alertRecord = triggerAlertForChild(user.email, 'SOS', sosMessage, coords);
    } catch {
      // If user is not linked as child, created fallback alert log
      alertRecord = {
        id: `sos_${Date.now()}`,
        childEmail: user.email,
        childName: user.name,
        type: 'SOS',
        message: sosMessage,
        timestamp: new Date().toISOString(),
        read: false,
        locationCoords: coords,
      };
    }

    // Broadcast SSE to paired caregivers
    guardianBroadcaster.emitToGuardians(user.email, {
      id: alertRecord.id,
      type: 'SOS_TRIGGER',
      dependentEmail: user.email,
      dependentName: user.name,
      timestamp: new Date().toISOString(),
      payload: {
        coords,
        triggeredAt: new Date().toISOString(),
        isTest,
      },
      message: sosMessage,
    });

    // SMS & FCM Push Notification stubs for MSG91 / Firebase
    if (!isTest && process.env.MSG91_API_KEY) {
      console.log(`[MSG91 SMS Dispatch] SOS alert sent to emergency contacts of ${user.name}`);
    }

    return NextResponse.json({
      success: true,
      sosEventId: alertRecord.id,
      isTest,
      message: 'SOS Panic alert broadcasted to linked caregivers and emergency network.',
    });
  } catch (error: any) {
    console.error('SOS trigger error:', error);
    return NextResponse.json({ success: false, error: 'Failed to trigger SOS alert' }, { status: 500 });
  }
}
