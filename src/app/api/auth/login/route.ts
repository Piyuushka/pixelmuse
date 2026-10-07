import { NextResponse } from 'next/server';
import { findUserByEmail, hashPassword, sanitizeUser } from '@/lib/db/userStore';
import { signToken, setAuthCookie, type TokenPayload } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

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

    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth login if configured
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { data: sbAuth, error: sbError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (sbAuth?.user) {
        const sbUser = sbAuth.user;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sbUser.id)
          .maybeSingle();

        const role = normaliseRole(profile?.role || sbUser.user_metadata?.role || 'USER');
        const name = profile?.full_name || sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User';
        const onboarding_complete = Boolean(profile?.onboarding_complete);

        const token = await signToken({
          userId: sbUser.id,
          email: sbUser.email!,
          role,
          name,
          onboarding_complete,
        });

        const safeUser = {
          id: sbUser.id,
          email: sbUser.email,
          name,
          role,
          onboarding_complete,
        };

        const response = NextResponse.json({
          message: 'Login successful',
          user: safeUser,
          role,
          onboarding_complete,
          token: `token_${sbUser.id}_${Date.now()}`,
        });

        setAuthCookie(response as any, token);
        return response;
      }
    }

    // 2. Fallback: Local userStore login
    const user = findUserByEmail(cleanEmail);
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
      token: `token_${user.id}_${Date.now()}`,
    });

    setAuthCookie(response as any, token);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}

