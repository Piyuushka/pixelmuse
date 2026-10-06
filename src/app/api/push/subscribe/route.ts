import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { pushSubscriptionSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

const pushSubscriptionsStore = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    const body = await request.json();
    const validated = pushSubscriptionSchema.parse(body);

    pushSubscriptionsStore.set(session.userId, {
      userId: session.userId,
      endpoint: validated.endpoint,
      keys: validated.keys,
      deviceLabel: validated.device_label || 'Web Device',
      updatedAt: new Date().toISOString(),
    });

    return apiSuccess({
      success: true,
      message: 'Web push subscription registered.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
