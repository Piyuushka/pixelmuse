import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, triggerAlertForChild } from '@/lib/db/userStore';
import { locationBroadcaster } from '@/lib/locationBroadcaster';
import { guardianBroadcaster } from '@/lib/guardianBroadcaster';
import { sosTriggerSchema } from '@/lib/validations/schemas';
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

    const body = await request.json();
    const validated = sosTriggerSchema.parse(body);

    const isTest = Boolean(validated.is_test);
    const sosId = `sos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const sosPayload = {
      id: sosId,
      userEmail: user.email,
      userName: user.name,
      lat: validated.lat,
      lng: validated.lng,
      accuracy: validated.accuracy_m,
      status: 'TRIGGERED' as const,
      isTest,
      triggeredAt: now,
      message: isTest
        ? `[TEST ALERT] Safety drill alert triggered by ${user.name}`
        : `EMERGENCY SOS! ${user.name} triggered panic alert at (${validated.lat.toFixed(4)}, ${validated.lng.toFixed(4)})`,
    };

    // 1. In-memory pub/sub broadcast
    locationBroadcaster.triggerSOS(sosPayload);

    // 2. Guardian broadcaster
    guardianBroadcaster.emitToGuardians(user.email, {
      id: sosId,
      type: 'SOS_TRIGGER',
      dependentEmail: user.email,
      dependentName: user.name,
      timestamp: now,
      payload: {
        coords: { lat: validated.lat, lng: validated.lng },
        triggeredAt: now,
      },
      message: sosPayload.message,
    });

    // 3. User store alert log
    try {
      triggerAlertForChild(user.email, 'SOS', sosPayload.message, { lat: validated.lat, lng: validated.lng });
    } catch {
      // Fallback
    }

    return apiSuccess({
      success: true,
      sosEventId: sosId,
      status: 'TRIGGERED',
      isTest,
      message: 'Emergency SOS panic alert broadcasted to linked caregivers.',
      triggeredAt: now,
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
