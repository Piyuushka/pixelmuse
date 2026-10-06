import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/db/userStore';
import { locationBroadcaster } from '@/lib/locationBroadcaster';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { searchParams } = new URL(request.url);
    const dependentEmail = searchParams.get('dependentEmail') || session.email;

    const activeSOS = locationBroadcaster.getActiveSOS(dependentEmail);

    return apiSuccess({
      success: true,
      hasActiveSOS: !!activeSOS,
      sosEvent: activeSOS,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
