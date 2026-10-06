import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getPendingConsentRequests, findUserById } from '@/lib/db/userStore';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const pendingRequests = getPendingConsentRequests(user.email);

    return NextResponse.json({
      success: true,
      pendingRequests,
      activeGuardian: user.linkedParentEmail || null,
      pairingCode: user.pairingCode,
      pairingCodeExpiresAt: user.pairingCodeExpiresAt,
    });
  } catch (error: any) {
    console.error('Error fetching consent status:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch consent status' }, { status: 500 });
  }
}
