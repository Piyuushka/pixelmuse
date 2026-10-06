import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, findUserByPairingCode, linkParentAndChild } from '@/lib/db/userStore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pairingCode } = body;

    if (!pairingCode || pairingCode.trim().length < 6) {
      return NextResponse.json({ success: false, error: 'A valid 6-digit pairing code is required.' }, { status: 400 });
    }

    const caregiver = findUserById(session.userId);
    if (!caregiver) {
      return NextResponse.json({ success: false, error: 'Caregiver account not found.' }, { status: 404 });
    }

    const dependent = findUserByPairingCode(pairingCode);
    if (!dependent) {
      return NextResponse.json(
        { success: false, error: 'Invalid pairing code or code expired. Ask dependent to generate a new code.' },
        { status: 404 }
      );
    }

    if (dependent.id === caregiver.id || dependent.email === caregiver.email) {
      return NextResponse.json({ success: false, error: 'Cannot link your own account as dependent.' }, { status: 400 });
    }

    // Link the parent/caregiver and child/dependent
    const updatedCaregiver = linkParentAndChild(caregiver.email, pairingCode);

    return NextResponse.json({
      success: true,
      message: `Successfully linked with ${dependent.name}.`,
      dependent: {
        id: dependent.id,
        name: dependent.name,
        email: dependent.email,
        pairingCode: dependent.pairingCode,
      },
    });
  } catch (error: any) {
    console.error('Pairing verification error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to verify pairing code' }, { status: 400 });
  }
}
