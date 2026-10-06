import { NextResponse } from 'next/server';
import {
  refreshPairingCode,
  linkParentAndChild,
  unlinkParentAndChild,
  findUserByEmail,
  sanitizeUser,
} from '@/lib/db/userStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, pairingCode, childEmail, parentEmail } = body;

    if (action === 'generate_code') {
      if (!email) {
        return NextResponse.json({ error: 'User email is required.' }, { status: 400 });
      }
      const newCode = refreshPairingCode(email);
      return NextResponse.json({
        message: 'Pairing code generated successfully',
        pairingCode: newCode,
      });
    }

    if (action === 'link_account') {
      if (!parentEmail || !pairingCode) {
        return NextResponse.json(
          { error: 'Parent email and 6-digit pairing code are required.' },
          { status: 400 }
        );
      }
      const updatedParent = linkParentAndChild(parentEmail, pairingCode);
      return NextResponse.json({
        message: 'Parent ↔ Child account linked successfully!',
        parent: sanitizeUser(updatedParent),
      });
    }

    if (action === 'unlink_account') {
      if (!parentEmail || !childEmail) {
        return NextResponse.json(
          { error: 'Parent email and child email are required to unlink.' },
          { status: 400 }
        );
      }
      unlinkParentAndChild(parentEmail, childEmail);
      return NextResponse.json({
        message: `Unlinked child account (${childEmail}) successfully.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action parameter.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Parental account linking operation failed' },
      { status: 500 }
    );
  }
}
