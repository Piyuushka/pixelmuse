import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, unlinkParentAndChild } from '@/lib/db/userStore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetEmail } = body;

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const caregiverEmail = user.role === 'parent' ? user.email : (targetEmail || user.linkedParentEmail || '');
    const childEmail = user.role === 'parent' ? (targetEmail || user.linkedChildrenEmails[0] || '') : user.email;

    if (caregiverEmail && childEmail) {
      unlinkParentAndChild(caregiverEmail, childEmail);
    }

    return NextResponse.json({
      success: true,
      message: 'Pairing request rejected and revoked.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Reject failed' }, { status: 500 });
  }
}
