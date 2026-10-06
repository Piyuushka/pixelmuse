import { NextRequest, NextResponse } from 'next/server';
import { createGuardianInvite } from '@/lib/db/userStore';

/**
 * POST /api/guardian/invite
 *
 * Guardian sends an invite to a dependent by email.
 * Creates a PENDING GuardianLink on both accounts.
 *
 * Body: { guardianEmail: string, dependentEmail: string }
 *
 * Auth: Validates that guardianEmail exists in the DB.
 * The dependent must call /api/guardian/accept to activate the link.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { guardianEmail, dependentEmail } = body;

    if (!guardianEmail || !dependentEmail) {
      return NextResponse.json(
        { error: 'Both guardianEmail and dependentEmail are required.' },
        { status: 400 }
      );
    }

    const link = createGuardianInvite(
      guardianEmail.trim().toLowerCase(),
      dependentEmail.trim().toLowerCase()
    );

    return NextResponse.json(
      {
        message: `Invitation sent to ${dependentEmail}. Waiting for their consent.`,
        link,
      },
      { status: 201 }
    );
  } catch (err: any) {
    const status = err.message?.includes('not found') ? 404 : 400;
    return NextResponse.json(
      { error: err.message || 'Failed to create guardian invite.' },
      { status }
    );
  }
}
