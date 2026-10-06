import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/db/userStore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { caregiverEmail } = body;

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Update link consent timestamp and active link status
    updateUser(user.id, {
      linkedParentEmail: caregiverEmail || user.linkedParentEmail,
      privacyConsent: {
        ...user.privacyConsent,
        consentVersion: 'v2.0_dpdp',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Caregiver linkage approved with DPDP data sharing consent.',
      consentGrantedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Approval failed' }, { status: 500 });
  }
}
