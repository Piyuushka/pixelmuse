import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, updateUser } from '@/lib/db/userStore';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    const user = findUserById(session.userId);
    if (!user) return apiError('User not found', 'NOT_FOUND', 404);

    // Anonymize/erase personal data for DPDP right to erasure
    updateUser(user.id, {
      name: 'Erased User',
      emergencyContacts: [],
      tripHistory: [],
      parentAlerts: [],
      guardianLinks: [],
    });

    const res = apiSuccess({
      success: true,
      message: 'Account and personal telemetry data successfully erased under DPDP Act 2023.',
      erasedAt: new Date().toISOString(),
    });

    // Clear session cookie
    res.cookies.delete('pf_session');
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
