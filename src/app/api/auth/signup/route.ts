import { NextRequest } from 'next/server';
import { signupSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';
import { createUser, findUserByEmail } from '@/lib/db/userStore';
import { signToken, setAuthCookie } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = signupSchema.parse(body);
    const cleanEmail = validated.email.trim().toLowerCase();

    let userId = '';

    // 1. Try registering in Supabase Auth
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: validated.password,
        email_confirm: true,
        user_metadata: {
          full_name: validated.fullName,
          role: validated.role,
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already') || authError.status === 422) {
          return apiError('An account with this email already exists.', 'EMAIL_EXISTS', 409);
        }
      } else if (authData.user) {
        userId = authData.user.id;
        await supabase.from('profiles').upsert({
          id: userId,
          email: cleanEmail,
          full_name: validated.fullName,
          role: validated.role,
          onboarding_complete: false,
        });
      }
    }

    const existing = findUserByEmail(cleanEmail);
    let newUser;
    if (!existing) {
      newUser = createUser(
        validated.fullName,
        cleanEmail,
        validated.password,
        validated.role
      );
      if (userId) newUser.id = userId;
    } else {
      newUser = existing;
      if (userId) newUser.id = userId;
    }

    const finalUserId = userId || newUser.id;

    // Create JWT session cookie
    const token = await signToken({
      userId: finalUserId,
      email: cleanEmail,
      name: validated.fullName,
      role: validated.role,
    });

    const res = apiSuccess({
      success: true,
      user: {
        id: finalUserId,
        email: cleanEmail,
        name: validated.fullName,
        role: validated.role,
        isMinor: false,
        onboardingComplete: false,
      },
      message: 'Account created successfully.',
    }, 201);

    setAuthCookie(res, token);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}

