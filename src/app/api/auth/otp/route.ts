import { NextResponse } from 'next/server';
import { findUserByEmail, getAllUsers, createUser, sanitizeUser } from '@/lib/db/userStore';
import { signToken, setAuthCookie } from '@/lib/auth';
import crypto from 'crypto';

// In-memory OTP storage for demo/development. In production, store in Redis / MSG91.
const otpStore = new Map<string, { code: string; expiresAt: number; phone: string; role: 'USER' | 'CAREGIVER' }>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, phone, code, role = 'USER' } = body;

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // ACTION: SEND OTP
    if (action === 'send') {
      const generatedCode = process.env.NODE_ENV === 'development' && cleanPhone.endsWith('9999')
        ? '123456'
        : Math.floor(100000 + Math.random() * 900000).toString();

      otpStore.set(cleanPhone, {
        code: generatedCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
        phone: cleanPhone,
        role: role.toUpperCase() === 'CAREGIVER' ? 'CAREGIVER' : 'USER',
      });

      // MSG91 / Twilio integration point:
      if (process.env.MSG91_API_KEY) {
        console.log(`[MSG91] Sending OTP ${generatedCode} to +91${cleanPhone}`);
      }

      return NextResponse.json({
        success: true,
        message: 'OTP sent successfully',
        devOtp: (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') ? generatedCode : undefined,
      });
    }

    // ACTION: VERIFY OTP
    if (action === 'verify') {
      if (!code) {
        return NextResponse.json({ success: false, error: 'OTP code is required' }, { status: 400 });
      }

      const stored = otpStore.get(cleanPhone);
      if (!stored) {
        return NextResponse.json({ success: false, error: 'No OTP requested for this phone number' }, { status: 400 });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(cleanPhone);
        return NextResponse.json({ success: false, error: 'OTP has expired. Please request a new one.' }, { status: 400 });
      }

      if (stored.code !== code.trim()) {
        return NextResponse.json({ success: false, error: 'Invalid OTP code' }, { status: 400 });
      }

      // OTP verified successfully! Clear stored OTP
      otpStore.delete(cleanPhone);

      const email = `phone_${cleanPhone}@pathfinder.local`;
      let user = findUserByEmail(email);

      if (!user) {
        const users = getAllUsers();
        user = users.find((u: any) => u.email.includes(cleanPhone));
      }

      const assignedRole = stored.role || 'USER';

      if (!user) {
        user = createUser(
          `User ${cleanPhone.slice(-4)}`,
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
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Must be "send" or "verify"' }, { status: 400 });
  } catch (error) {
    console.error('OTP handler error:', error);
    return NextResponse.json({ success: false, error: 'Internal OTP error' }, { status: 500 });
  }
}
