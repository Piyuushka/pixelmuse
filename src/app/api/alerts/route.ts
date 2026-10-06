import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/db/userStore';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    const user = findUserById(session.userId);
    if (!user) return apiError('User not found', 'NOT_FOUND', 404);

    const alerts = user.parentAlerts || [];

    return apiSuccess({
      success: true,
      total: alerts.length,
      alerts,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
