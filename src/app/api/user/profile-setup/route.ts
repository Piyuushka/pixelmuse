import { NextResponse } from 'next/server';
import { getServerSession, signToken, setAuthCookie } from '@/lib/auth';
import { findUserByEmail, updateUserOnboardingProfile, sanitizeUser, EmergencyContact } from '@/lib/db/userStore';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const user = findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
        primaryPersona: user.accessibilityPreferences?.primaryPersona || 'wheelchair',
        mobilityType: user.accessibilityPreferences?.mobilityType || 'manual-wheelchair',
        emergencyContacts: user.emergencyContacts || [],
        preferredLanguage: user.preferredLanguage || 'en',
        onboarding_complete: Boolean(user.onboarding_complete ?? user.hasCompletedProfile),
        role: session.role,
      },
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
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, mobilityPersona, mobilityType, emergencyContacts, preferredLanguage } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Please enter your full name (at least 2 characters).' }, { status: 400 });
    }

    const validPersonas = ['wheelchair', 'older-adult', 'low-vision', 'caregiver', 'none'];
    if (!mobilityPersona || !validPersonas.includes(mobilityPersona)) {
      return NextResponse.json({ error: 'Please select a valid mobility profile.' }, { status: 400 });
    }

    const contacts: EmergencyContact[] = Array.isArray(emergencyContacts) ? emergencyContacts : [];
    if (contacts.length === 0 || !contacts[0]?.name?.trim() || !contacts[0]?.phone?.trim()) {
      return NextResponse.json({ error: 'Please provide at least one emergency contact with a name and phone number.' }, { status: 400 });
    }

    const updatedUser = updateUserOnboardingProfile(session.email, {
      name: name.trim(),
      mobilityPersona,
      mobilityType: mobilityType || 'standard',
      emergencyContacts: contacts.map((c, i) => ({
        id: c.id || `ec_${Date.now()}_${i}`,
        name: c.name.trim(),
        phone: c.phone.trim(),
        relationship: c.relationship || 'Emergency Contact',
        notifyOnSOS: c.notifyOnSOS ?? true,
      })),
      preferredLanguage: preferredLanguage || 'en',
    });

    const newToken = await signToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: session.role || 'USER',
      name: updatedUser.name,
      onboarding_complete: true,
    });

    const response = NextResponse.json({
      message: 'User profile setup completed successfully.',
      user: {
        ...sanitizeUser(updatedUser),
        role: session.role,
        onboarding_complete: true,
      },
      onboarding_complete: true,
    });

    setAuthCookie(response, newToken);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save user profile' },
      { status: 500 }
    );
  }
}
