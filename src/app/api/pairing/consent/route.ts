import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, respondToConsentRequest } from '@/lib/db/userStore';

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

    const body = await request.json();
    const { linkId, action } = body; // action: 'accept' | 'reject'

    if (!linkId || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid linkId or action' }, { status: 400 });
    }

    const updatedLink = respondToConsentRequest(linkId, user.email, action === 'accept');

    return NextResponse.json({
      success: true,
      action,
      link: updatedLink,
      message: action === 'accept' ? 'Pairing request approved.' : 'Pairing request rejected.',
    });
  } catch (error: any) {
    console.error('Error responding to consent request:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to process consent request' }, { status: 400 });
  }
}
