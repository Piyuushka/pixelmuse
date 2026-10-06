import { NextRequest, NextResponse } from 'next/server';
import { acceptGuardianInvite } from '@/lib/db/userStore';

/**
 * POST /api/guardian/accept
 *
 * Dependent accepts a PENDING guardian invite by linkId.
 * Transitions the GuardianLink from PENDING → ACCEPTED, sets consentGrantedAt.
 *
 * Body: { linkId: string, dependentEmail: string }
 *
 * RBAC: Only the dependent identified by dependentEmail can accept.
 *       The store function throws if the email doesn't match the link's dependentEmail.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { linkId, dependentEmail } = body;

    if (!linkId || !dependentEmail) {
      return NextResponse.json(
        { error: 'Both linkId and dependentEmail are required.' },
        { status: 400 }
      );
    }

    const link = acceptGuardianInvite(linkId, dependentEmail.trim().toLowerCase());

    return NextResponse.json({
      message: 'Guardian access accepted. The guardian can now monitor your trips.',
      link,
    });
  } catch (err: any) {
    const status =
      err.message?.includes('not found') ? 404 :
      err.message?.includes('Only the dependent') ? 403 : 400;
    return NextResponse.json(
      { error: err.message || 'Failed to accept guardian invite.' },
      { status }
    );
  }
}
