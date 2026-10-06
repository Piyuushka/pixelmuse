import { NextResponse } from 'next/server';
import { findUserByEmail, hashPassword, sanitizeUser } from '@/lib/db/userStore';
import { signToken, setAuthCookie, type TokenPayload } from '@/lib/auth';

// Map legacy role strings to the new typed enum.
function normaliseRole(role: string): TokenPayload['role'] {
  if (role === 'parent' || role === 'CAREGIVER') return 'CAREGIVER';
  if (role === 'admin' || role === 'ADMIN') return 'ADMIN';
  return 'USER';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email address and password are required.' },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const inputHash = hashPassword(password);
    if (user.passwordHash !== inputHash) {
      return NextResponse.json(
        { error: 'Invalid email address or password.' },
        { status: 401 }
      );
    }

    const role = normaliseRole(user.role);
    const onboarding_complete = Boolean(user.onboarding_complete ?? user.hasCompletedProfile);
    const safeUser = { ...sanitizeUser(user), role, onboarding_complete };

    // Issue signed JWT with onboarding_complete.
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role,
      name: user.name,
      onboarding_complete,
    });

    const response = NextResponse.json({
      message: 'Login successful',
      user: safeUser,
      role,
      onboarding_complete,
      // Legacy plain token kept for backward compat with AccessibilityContext.
      token: `token_${user.id}_${Date.now()}`,
    });

    // Set HTTP-only session cookie.
    setAuthCookie(response as any, token);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}
