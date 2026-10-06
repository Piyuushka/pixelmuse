import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/db/userStore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sosEventId } = body;

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      sosEventId,
      status: 'RESOLVED',
      resolvedBy: user.name,
      resolvedAt: new Date().toISOString(),
      message: 'Emergency SOS status marked as RESOLVED.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to resolve SOS' }, { status: 500 });
  }
}
