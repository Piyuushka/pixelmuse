import { NextResponse } from 'next/server';
import { findUserByEmail, createUser, sanitizeUser } from '@/lib/db/userStore';
import { signToken, setAuthCookie } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { googleToken, email, name, role = 'USER' } = body;

    // In production, verify the OAuth token with Google APIs (e.g. google-auth-library)
    // Here we support provided email/name from client Google Credential or mock token
    if (!email) {
      return NextResponse.json({ success: false, error: 'Google email is required' }, { status: 400 });
    }

    let user = findUserByEmail(email);
    const assignedRole = (role.toUpperCase() === 'CAREGIVER' ? 'CAREGIVER' : 'USER') as 'USER' | 'CAREGIVER';

    if (!user) {
      user = createUser(
        name || email.split('@')[0],
        email,
        crypto.randomBytes(16).toString('hex'),
        assignedRole === 'CAREGIVER' ? 'parent' : 'user',
        assignedRole === 'USER' ? Math.floor(100000 + Math.random() * 900000).toString() : undefined
      );
    }

    const tokenRole = (user.role?.toUpperCase() as 'USER' | 'CAREGIVER' | 'ADMIN') || assignedRole;
    const onboarding_complete = Boolean(user.onboarding_complete ?? user.hasCompletedProfile);

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: tokenRole,
      name: user.name,
      onboarding_complete,
    });

    const response = NextResponse.json({
      success: true,
      user: { ...sanitizeUser(user), onboarding_complete },
      role: tokenRole,
      onboarding_complete,
      pairingCode: user.pairingCode,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.json({ success: false, error: 'Google sign-in failed' }, { status: 500 });
  }
}
