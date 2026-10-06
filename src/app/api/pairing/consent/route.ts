import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { respondToConsent } from '@/lib/db/pairingStore';

/**
 * POST /api/pairing/consent
 *
 * Body: { linkId: string, action: 'accept' | 'reject' }
 *
 * Called by the dependent (user) when they see a pending caregiver request on
 * the "Share My Location" screen.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { linkId, action } = body;

    if (!linkId || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid linkId or action' },
        { status: 400 }
      );
    }

    const result = await respondToConsent(linkId, session.userId, action === 'accept');

    return NextResponse.json({
      success: true,
      action,
      link: result,
      message: action === 'accept' ? 'Pairing request approved.' : 'Pairing request rejected.',
    });
  } catch (error: any) {
    console.error('Error responding to consent request:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process consent request' },
      { status: 400 }
    );
  }
}
