import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getConsentStatus, generatePairingCode } from '@/lib/db/pairingStore';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let status = await getConsentStatus(session.userId, session.email);

    // If no active code exists, generate one automatically
    if (!status.pairingCode) {
      try {
        const generated = await generatePairingCode(session.userId);
        status = {
          ...status,
          pairingCode: generated.code,
          pairingCodeExpiresAt: generated.expiresAt,
        };
      } catch {
        // Non-fatal: UI will show Regenerate button
      }
    }

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
