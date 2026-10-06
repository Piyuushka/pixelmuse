import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, findUserByEmail } from '@/lib/db/userStore';
import { getLocationHistory24h } from '@/lib/locationCache';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dependentEmail = searchParams.get('dependentEmail');

    const currentUser = findUserById(session.userId);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const targetEmail = dependentEmail || currentUser.email;

    // RBAC: Check authorization if requesting another user's history
    if (targetEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
      const isAuthorized = currentUser.linkedChildrenEmails.some(
        (email) => email.toLowerCase() === targetEmail.toLowerCase()
      );
      if (!isAuthorized) {
        return NextResponse.json({ success: false, error: 'Forbidden: You are not paired with this dependent' }, { status: 403 });
      }
    }

    const history = getLocationHistory24h(targetEmail);
    const dependentUser = findUserByEmail(targetEmail);

    return NextResponse.json({
      success: true,
      dependentEmail: targetEmail,
      dependentName: dependentUser?.name || 'Dependent',
      pingsCount: history.length,
      history,
    });
  } catch (error: any) {
    console.error('Location history error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch location history' }, { status: 500 });
  }
}
