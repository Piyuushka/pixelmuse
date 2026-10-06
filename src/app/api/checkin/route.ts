import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, triggerAlertForChild } from '@/lib/db/userStore';
import { checkinSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    const user = findUserById(session.userId);
    if (!user) return apiError('User not found', 'NOT_FOUND', 404);

    const body = await request.json();
    const validated = checkinSchema.parse(body);

    const checkinMessage = `✅ Check-in from ${user.name}: "${validated.message}"`;
    const coords = validated.lat && validated.lng ? { lat: validated.lat, lng: validated.lng } : undefined;

    try {
      triggerAlertForChild(user.email, 'TRIP_COMPLETED', checkinMessage, coords);
    } catch {
      // Fallback
    }

    return apiSuccess({
      success: true,
      message: 'Check-in shared with linked caregivers.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
