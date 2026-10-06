import { NextRequest } from 'next/server';
import { signupSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';
import { createUser, findUserByEmail } from '@/lib/db/userStore';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = signupSchema.parse(body);

    const existing = findUserByEmail(validated.email);
    if (existing) {
      return apiError('An account with this email already exists.', 'EMAIL_EXISTS', 409);
    }

    // Create user in store with server-verified role
    const newUser = createUser(
      validated.fullName,
      validated.email,
      validated.password,
      validated.role
    );

    // Create JWT session cookie
    const token = await signToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: validated.role,
    });

    const res = apiSuccess({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
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
