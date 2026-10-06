import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, findUserByEmail, getAllUsers } from '@/lib/db/userStore';

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

    const users = getAllUsers();
    let linkedDependents: any[] = [];
    let linkedCaregivers: any[] = [];

    if (user.role === 'parent' || user.linkedChildrenEmails.length > 0) {
      linkedDependents = users
        .filter((u) => user.linkedChildrenEmails.includes(u.email))
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          pairingCode: u.pairingCode,
          activeTrip: u.activeTrip,
          hasCompletedProfile: u.hasCompletedProfile,
        }));
    }

    if (user.linkedParentEmail) {
      const caregiverUser = findUserByEmail(user.linkedParentEmail);
      if (caregiverUser) {
        linkedCaregivers.push({
          id: caregiverUser.id,
          name: caregiverUser.name,
          email: caregiverUser.email,
        });
      }
    }

    return NextResponse.json({
      success: true,
      role: user.role,
      pairingCode: user.pairingCode,
      dependents: linkedDependents,
      caregivers: linkedCaregivers,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch links' }, { status: 500 });
  }
}
