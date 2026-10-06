import { NextResponse } from 'next/server';
import { getServerSession, signToken, setAuthCookie } from '@/lib/auth';
import { findUserByEmail, updateCaregiverProfile, sanitizeUser, CaregiverAlertPreferences } from '@/lib/db/userStore';

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
        phone: user.phone || '',
        relationship: user.relationship || 'parent',
        preferredLanguage: user.preferredLanguage || 'en',
        alertPreferences: user.alertPreferences || { push: true, sms: true, email: true },
        photoUrl: user.photoUrl || '',
        onboarding_complete: Boolean(user.onboarding_complete ?? user.hasCompletedProfile),
        role: session.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch caregiver profile' },
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
    const { name, phone, relationship, preferredLanguage, alertPreferences, photoUrl } = body;

    // Strict validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Please enter your full name (at least 2 characters).' }, { status: 400 });
    }

    const cleanPhone = (phone || '').toString().trim().replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      return NextResponse.json({ error: 'Please provide a valid phone number (at least 8 digits).' }, { status: 400 });
    }

    const validRelationships = ['parent', 'guardian', 'family', 'professional_caregiver'];
    if (!relationship || !validRelationships.includes(relationship)) {
      return NextResponse.json(
        { error: 'Please select a valid relationship (parent, guardian, family, or professional caregiver).' },
        { status: 400 }
      );
    }

    if (!preferredLanguage || typeof preferredLanguage !== 'string') {
      return NextResponse.json({ error: 'Please select your preferred language.' }, { status: 400 });
    }

    if (!alertPreferences || typeof alertPreferences !== 'object') {
      return NextResponse.json({ error: 'Alert preferences are required.' }, { status: 400 });
    }

    const parsedAlerts: CaregiverAlertPreferences = {
      push: Boolean(alertPreferences.push),
      sms: Boolean(alertPreferences.sms),
      email: Boolean(alertPreferences.email),
    };

    if (!parsedAlerts.push && !parsedAlerts.sms && !parsedAlerts.email) {
      return NextResponse.json(
        { error: 'Please enable at least one notification channel (Push, SMS, or Email).' },
        { status: 400 }
      );
    }

    // Save to database
    const updatedUser = updateCaregiverProfile(session.email, {
      name: name.trim(),
      phone: cleanPhone,
      relationship,
      preferredLanguage,
      alertPreferences: parsedAlerts,
      photoUrl: photoUrl || '',
    });

    // Re-issue JWT session token with onboarding_complete: true and updated name
    const newToken = await signToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: session.role || 'CAREGIVER',
      name: updatedUser.name,
      onboarding_complete: true,
    });

    const response = NextResponse.json({
      message: 'Caregiver profile setup completed successfully.',
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
      { error: error.message || 'Failed to save caregiver profile' },
      { status: 500 }
    );
  }
}
