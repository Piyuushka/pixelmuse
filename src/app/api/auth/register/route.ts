import { NextResponse } from 'next/server';
import { createUser, findUserByEmail, sanitizeUser } from '@/lib/db/userStore';
import { signToken, setAuthCookie, type TokenPayload } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
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
 * Registers user in Supabase Auth & public.profiles table.
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

    const cleanEmail = email.trim().toLowerCase();
    const role = normaliseRole(rawRole);
    const cleanName = name.trim();

    let userId = '';

    // 1. Register with Supabase Auth if configured
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          role,
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already') || authError.status === 422) {
          return NextResponse.json(
            { error: 'An account with this email already exists.' },
            { status: 409 }
          );
        }
        console.warn('Supabase auth register error:', authError.message);
      } else if (authData.user) {
        userId = authData.user.id;
        // Upsert into public.profiles table
        const { error: profileErr } = await supabase.from('profiles').upsert({
          id: userId,
          email: cleanEmail,
          full_name: cleanName,
          role,
          onboarding_complete: false,
        });
        if (profileErr) {
          console.error('Failed to create Supabase profile row:', profileErr.message);
        }
      }
    }

    // 2. Sync to local userStore for backward compatibility
    const existingStoreUser = findUserByEmail(cleanEmail);
    let user;
    if (!existingStoreUser) {
      const pairingCode = String(crypto.randomInt(100000, 999999));
      user = createUser(
        cleanName,
        cleanEmail,
        password,
        role === 'CAREGIVER' ? 'parent' : 'user',
        pairingCode
      );
      if (userId) user.id = userId;
    } else {
      user = existingStoreUser;
      if (userId) user.id = userId;
    }

    const finalUserId = userId || user.id;
    const onboarding_complete = Boolean(user.onboarding_complete ?? user.hasCompletedProfile);
    const safeUser = { ...sanitizeUser(user), id: finalUserId, role, onboarding_complete };

    // Issue signed JWT with onboarding_complete
    const token = await signToken({
      userId: finalUserId,
      email: cleanEmail,
      role,
      name: cleanName,
      onboarding_complete,
    });

    const response = NextResponse.json(
      {
        message: 'Registration successful.',
        user: safeUser,
        role,
        onboarding_complete,
        token: `token_${finalUserId}_${Date.now()}`,
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


