import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { refreshPairingCode, findUserById } from '@/lib/db/userStore';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const user = findUserById(session.userId);
    if (!user) {
      return apiError('User not found', 'NOT_FOUND', 404);
    }

    const { code, expiresAt } = refreshPairingCode(user.email);

    return apiSuccess({
      success: true,
      code,
      expiresAt,
      qrPayload: `pathfinder:pair:${code}`,
      ttlSeconds: 600,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
