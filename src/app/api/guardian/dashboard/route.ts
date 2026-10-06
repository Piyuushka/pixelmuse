import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { listDependents } from '@/lib/db/pairingStore';

/**
 * GET /api/guardian/dashboard
 *
 * Returns the list of dependents linked to the logged-in caregiver.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const dependents = await listDependents(session.userId, session.email);

    return NextResponse.json({
      success: true,
      dependents,
    });
  } catch (error: any) {
    console.error('Error fetching dependents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load dependents' },
      { status: 500 }
    );
  }
}
