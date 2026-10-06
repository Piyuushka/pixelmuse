import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/db/userStore';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    const { id } = await params;
    const user = findUserById(session.userId);
    if (!user) return apiError('User not found', 'NOT_FOUND', 404);

    const alerts = user.parentAlerts || [];
    const alert = alerts.find(a => a.id === id);
    if (alert) {
      alert.read = true;
      updateUser(user.id, { parentAlerts: alerts });
    }

    return apiSuccess({
      success: true,
      alertId: id,
      read: true,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
