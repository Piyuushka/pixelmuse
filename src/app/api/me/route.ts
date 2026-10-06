import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/db/userStore';
import { updateProfileSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const user = findUserById(session.userId);
    if (!user) {
      return apiError('User not found', 'NOT_FOUND', 404);
    }

    return apiSuccess({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: session.role,
        pairingCode: user.pairingCode,
        pairingCodeExpiresAt: user.pairingCodeExpiresAt,
        linkedParentEmail: user.linkedParentEmail,
        hasCompletedProfile: user.hasCompletedProfile,
        accessibilityPreferences: user.accessibilityPreferences,
        emergencyContacts: user.emergencyContacts,
        privacySettings: user.privacySettings,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    const user = findUserById(session.userId);
    if (!user) {
      return apiError('User not found', 'NOT_FOUND', 404);
    }

    const updates: any = {};
    if (validated.fullName) updates.name = validated.fullName;
    if (validated.onboardingComplete !== undefined) updates.hasCompletedProfile = validated.onboardingComplete;
    if (validated.mobilityProfile) {
      updates.accessibilityPreferences = {
        ...user.accessibilityPreferences,
        ...validated.mobilityProfile,
      };
    }

    const updated = updateUser(user.id, updates);

    return apiSuccess({
      success: true,
      profile: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: session.role,
        hasCompletedProfile: updated.hasCompletedProfile,
        accessibilityPreferences: updated.accessibilityPreferences,
      },
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
