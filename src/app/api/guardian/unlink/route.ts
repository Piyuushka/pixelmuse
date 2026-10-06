import { NextRequest, NextResponse } from 'next/server';
import { revokeGuardianLink } from '@/lib/db/userStore';

/**
 * POST /api/guardian/unlink
 *
 * Revokes a guardian link. Either the guardian or the dependent can revoke.
 * Sets status → REVOKED and records revokedAt timestamp.
 *
 * Body: { linkId: string, requestorEmail: string }
 *
 * RBAC: The store function validates that requestorEmail is a party to the link.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { linkId, requestorEmail } = body;

    if (!linkId || !requestorEmail) {
      return NextResponse.json(
        { error: 'Both linkId and requestorEmail are required.' },
        { status: 400 }
      );
    }

    const link = revokeGuardianLink(linkId, requestorEmail.trim().toLowerCase());

    return NextResponse.json({
      message: 'Guardian link revoked. Location sharing has been stopped immediately.',
      link,
    });
  } catch (err: any) {
    const status =
      err.message?.includes('not found') ? 404 :
      err.message?.includes('not a party') ? 403 : 400;
    return NextResponse.json(
      { error: err.message || 'Failed to revoke guardian link.' },
      { status }
    );
  }
}
