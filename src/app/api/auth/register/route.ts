import { NextResponse } from 'next/server';
import { createUser, findUserByEmail, sanitizeUser } from '@/lib/db/userStore';
import { signToken, setAuthCookie, type TokenPayload } from '@/lib/auth';
import crypto from 'crypto';

function normaliseRole(raw: string): TokenPayload['role'] {
  if (raw === 'CAREGIVER' || raw === 'parent') return 'CAREGIVER';
  if (raw === 'ADMIN') return 'ADMIN';
  return 'USER';
}

/**
 * POST /api/auth/register
 *
 * Body: { name, email, password, role: 'USER' | 'CAREGIVER', phone? }
 * Returns: { user, message } + sets HTTP-only JWT cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role: rawRole } = body;

    if (!name || !email || !password || !rawRole) {
      return NextResponse.json(
        { error: 'name, email, password and role are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const existing = findUserByEmail(email.trim().toLowerCase());
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const role = normaliseRole(rawRole);

    // Generate a cryptographically random 6-digit pairing code for USER accounts.
    const pairingCode = role === 'USER'
      ? String(crypto.randomInt(100000, 999999))
      : String(crypto.randomInt(100000, 999999)); // caregivers also get one for future use

    const user = createUser(
      name.trim(),
      email.trim().toLowerCase(),
      password,
      role === 'CAREGIVER' ? 'parent' : 'user',
      pairingCode,
    );

    const safeUser = sanitizeUser(user);

    // Issue signed JWT.
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role,
      name: user.name,
    });

    const response = NextResponse.json(
      {
        message: 'Registration successful.',
        user: { ...safeUser, role },
      },
      { status: 201 }
    );

    setAuthCookie(response as any, token);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Registration failed.' },
      { status: 500 }
    );
  }
}

