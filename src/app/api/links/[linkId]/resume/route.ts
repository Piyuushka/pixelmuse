import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/db/userStore';
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

    const links = user.guardianLinks || [];
    const link = links.find(l => l.id === linkId);
    if (!link) {
      return apiError('Caregiver link not found', 'NOT_FOUND', 404);
    }

    if (link.dependentEmail.toLowerCase() !== user.email.toLowerCase()) {
      return apiError('Only the dependent can resume location sharing', 'FORBIDDEN', 403);
    }

    link.status = 'ACCEPTED';
    updateUser(user.id, { guardianLinks: links });

    return apiSuccess({
      success: true,
      linkId,
      status: 'ACTIVE',
      message: 'Location sharing resumed.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
