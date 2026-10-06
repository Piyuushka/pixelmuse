import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getConsentStatus } from '@/lib/db/pairingStore';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Pure read-only check
    const status = await getConsentStatus(session.userId, session.email);

    return NextResponse.json({
      success: true,
      pairingCode: status.pairingCode,
      pairingCodeExpiresAt: status.pairingCodeExpiresAt,
      pendingRequests: status.pendingRequests,
      activeGuardian: status.activeCaregiver,
    });
  } catch (error: any) {
    console.error('Error fetching consent status:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch consent status' }, { status: 500 });
  }
}
