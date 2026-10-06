import { NextResponse } from 'next/server';
import { findUserByEmail, updateUserPreferences, sanitizeUser } from '@/lib/db/userStore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'User email parameter is required.' },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, preferences } = body;

    if (!email || !preferences) {
      return NextResponse.json(
        { error: 'User email and preferences object are required.' },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    const updatedUser = updateUserPreferences(email, preferences);
    const safeUser = sanitizeUser(updatedUser);

    return NextResponse.json({
      message: 'Accessibility profile saved to database successfully',
      user: safeUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save accessibility profile' },
      { status: 500 }
    );
  }
}
