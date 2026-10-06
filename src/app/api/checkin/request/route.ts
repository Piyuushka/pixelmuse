import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, triggerAlertForChild } from '@/lib/db/userStore';
import { checkinRequestSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    if (session.role !== 'CAREGIVER') {
      return apiError('Only caregivers can request check-ins', 'FORBIDDEN', 403);
    }

    const caregiver = findUserById(session.userId);
    if (!caregiver) return apiError('Caregiver not found', 'NOT_FOUND', 404);

    const body = await request.json();
    const validated = checkinRequestSchema.parse(body);

    const dependent = findUserById(validated.dependent_id);
    if (!dependent) return apiError('Dependent not found', 'NOT_FOUND', 404);

    return apiSuccess({
      success: true,
      message: `Check-in request sent to ${dependent.name}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
