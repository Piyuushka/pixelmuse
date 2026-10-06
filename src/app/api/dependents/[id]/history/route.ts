import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById, assertGuardianAccess } from '@/lib/db/userStore';
import { locationBroadcaster } from '@/lib/locationBroadcaster';
import { locationHistoryQuerySchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    const caregiver = findUserById(session.userId);
    if (!caregiver) {
      return apiError('Caregiver not found', 'NOT_FOUND', 404);
    }

    const dependent = findUserById(id);
    if (!dependent) {
      return apiError('Dependent not found', 'NOT_FOUND', 404);
    }

    // Verify RBAC access (active guardian link required)
    if (session.role !== 'CAREGIVER' && session.userId !== dependent.id) {
      return apiError('Access denied', 'FORBIDDEN', 403);
    }

    const { searchParams } = new URL(request.url);
    const validatedQuery = locationHistoryQuerySchema.parse({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      limit: searchParams.get('limit') || undefined,
      page: searchParams.get('page') || undefined,
    });

    const history = locationBroadcaster.getHistory(dependent.email);

    return apiSuccess({
      success: true,
      dependentId: dependent.id,
      dependentName: dependent.name,
      totalPoints: history.length,
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      points: history,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
