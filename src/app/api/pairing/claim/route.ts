import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { requestPairingByCode, findUserById } from '@/lib/db/userStore';
import { pairingClaimSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    if (session.role !== 'CAREGIVER') {
      return apiError('Only caregivers can claim a pairing code.', 'FORBIDDEN', 403);
    }

    const caregiver = findUserById(session.userId);
    if (!caregiver) {
      return apiError('Caregiver account not found.', 'NOT_FOUND', 404);
    }

    const body = await request.json();
    const validated = pairingClaimSchema.parse(body);

    const result = requestPairingByCode(caregiver.email, validated.code);

    return apiSuccess({
      success: true,
      linkId: result.link.id,
      status: result.link.status,
      dependent: result.dependent,
      message: result.link.status === 'ACCEPTED'
        ? 'Already paired with this dependent.'
        : 'Connection request sent. Awaiting dependent approval on their device.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
