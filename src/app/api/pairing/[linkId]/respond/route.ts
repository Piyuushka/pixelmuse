import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { respondToConsentRequest, findUserById } from '@/lib/db/userStore';
import { pairingRespondSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { linkId } = await params;
    const body = await request.json();
    const validated = pairingRespondSchema.parse(body);

    const user = findUserById(session.userId);
    if (!user) {
      return apiError('User not found', 'NOT_FOUND', 404);
    }

    const link = respondToConsentRequest(linkId, user.email, validated.action === 'APPROVE');

    return apiSuccess({
      success: true,
      linkId: link.id,
      status: link.status,
      message: validated.action === 'APPROVE'
        ? 'Caregiver link activated. Real-time safety monitoring enabled.'
        : 'Caregiver connection request rejected.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}
