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

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const testMessage = `[TEST MODE] Safety Panic Test triggered by ${user.name}`;
    const coords = { lat: 19.0760, lng: 72.8777 };

    guardianBroadcaster.emitToGuardians(user.email, {
      id: `test_${Date.now()}`,
      type: 'SOS_TRIGGER',
      dependentEmail: user.email,
      dependentName: user.name,
      timestamp: new Date().toISOString(),
      payload: {
        coords,
        triggeredAt: new Date().toISOString(),
        isTest: true,
      },
      message: testMessage,
    });

    return NextResponse.json({
      success: true,
      isTest: true,
      message: 'Safety drill trigger successfully evaluated. No real SMS or emergency dispatch performed.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to run SOS test' }, { status: 500 });
  }
}
