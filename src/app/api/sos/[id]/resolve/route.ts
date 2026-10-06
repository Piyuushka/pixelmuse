import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/db/userStore';
import { locationBroadcaster } from '@/lib/locationBroadcaster';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const user = findUserById(session.userId);
    if (!user) {
      return apiError('User not found', 'NOT_FOUND', 404);
    }

    const body = await request.json().catch(() => ({}));
    const dependentEmail = body.dependentEmail || session.email;

    const resolved = locationBroadcaster.resolveSOS(dependentEmail, user.name);

    return apiSuccess({
      success: true,
      sosEventId: id,
      status: 'RESOLVED',
      resolvedBy: user.name,
      resolvedAt: new Date().toISOString(),
      message: `SOS alert resolved by ${user.name}.`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
