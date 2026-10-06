import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, sanitizeUser } from '@/lib/db/userStore';
import { locationBroadcaster } from '@/lib/locationBroadcaster';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    const user = findUserById(session.userId);
    if (!user) return apiError('User not found', 'NOT_FOUND', 404);

    const history = locationBroadcaster.getHistory(user.email);

    return apiSuccess({
      success: true,
      exportTimestamp: new Date().toISOString(),
      dpdpCompliance: {
        act: 'Digital Personal Data Protection Act, 2023 (India)',
        purpose: 'User-initiated personal data export',
      },
      userData: sanitizeUser(user),
      locationTelemetry: history,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
