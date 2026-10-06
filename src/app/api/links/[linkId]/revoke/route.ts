import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { revokeGuardianLink, findUserById } from '@/lib/db/userStore';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { linkId } = await params;
    const user = findUserById(session.userId);
    if (!user) {
      return apiError('User not found', 'NOT_FOUND', 404);
    }

    const revokedLink = revokeGuardianLink(linkId, user.email);

    return apiSuccess({
      success: true,
      linkId: revokedLink.id,
      status: 'REVOKED',
      message: 'Caregiver connection revoked. Location access terminated immediately.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
