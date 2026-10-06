import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest, signToken, setAuthCookie } from '@/lib/auth';
import { findUserById, sanitizeUser } from '@/lib/db/userStore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const role = (user.role?.toUpperCase() as 'USER' | 'CAREGIVER' | 'ADMIN') || 'USER';
    const newToken = await signToken({
      userId: user.id,
      email: user.email,
      role: role,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: sanitizeUser(user),
      role: role,
    });

    setAuthCookie(response, newToken);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to refresh token' }, { status: 500 });
  }
}
