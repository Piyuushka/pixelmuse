import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { claimPairingCode } from '@/lib/db/pairingStore';

/**
 * POST /api/pairing/claim
 *
 * Body: { code: string }
 *
 * Caregiver submits the 6-digit code shown on the dependent's phone.
 * Creates a PENDING caregiver_link and returns it — the dependent must approve
 * on their "Share My Location" screen before the link becomes ACTIVE.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'CAREGIVER') {
      return NextResponse.json(
        { success: false, error: 'Only caregivers can claim a pairing code.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawCode: string = (body.code ?? body.pairingCode ?? '').toString().replace(/\D/g, '');

    if (rawCode.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A valid 6-digit pairing code is required.' },
        { status: 400 }
      );
    }

    const result = await claimPairingCode(session.userId, session.email, rawCode);

    return NextResponse.json({
      success: true,
      linkId: result.linkId,
      status: result.status,
      dependent: result.dependent,
      message:
        result.status === 'ACTIVE'
          ? 'Already paired with this dependent.'
          : 'Connection request sent. Awaiting dependent approval on their device.',
    });
  } catch (err: any) {
    console.error('Pairing claim error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to claim pairing code' },
      { status: 400 }
    );
  }
}
