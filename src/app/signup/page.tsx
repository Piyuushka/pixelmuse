'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import { OnboardingWizard, OnboardingData } from '@/components/OnboardingWizard';
import {
  Navigation,
  Mail,
  Lock,
  User,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { speakText } = useAccessibility();

  const [step, setStep] = useState<'auth' | 'onboarding'>('auth');
  const [role, setRole] = useState<'CAREGIVER' | 'USER'>('USER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      speakText(`Account created for ${data.user.name}. Proceeding to onboarding.`);
      setStep('onboarding');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnboardingComplete = async (onboardingData: OnboardingData) => {
    try {
      // Save profile preferences
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: onboardingData.fullName || name,
          preferences: {
            mobilityType: onboardingData.mobilityNeeds[0] || 'standard',
            needAudioPrompts: onboardingData.language !== 'en',
          },
        }),
      });

      speakText('Setup completed successfully! Redirecting to your dashboard.');

      if (role === 'CAREGIVER') {
        router.push('/caregiver-dashboard');
      } else {
        router.push('/safety-routing');
      }
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      // Proceed anyway
      if (role === 'CAREGIVER') router.push('/caregiver-dashboard');
      else router.push('/safety-routing');
    }
  };

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6">
      {/* Top Logo Header */}
      <Link href="/landing" className="flex items-center gap-3 mb-8 group focus:outline-none focus:ring-4 focus:ring-primary rounded-2xl p-1">
        <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
          <Navigation className="w-6 h-6 text-white fill-current" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-black text-on-surface tracking-tight">
            PathFinder Safety
          </span>
          <span className="text-[11px] text-on-surface-variant font-extrabold uppercase tracking-wider">
            Barrier-Free Navigation & Guardian Portal
          </span>
        </div>
      </Link>

      {step === 'auth' ? (
        <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-xl p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-black text-on-surface tracking-tight">
              Create Your Account
            </h1>
            <p className="text-xs text-on-surface-variant font-medium">
              Choose your role to get started with PathFinder.
            </p>
          </div>

          {/* ROLE SELECTOR */}
          <div className="p-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex gap-2" role="tablist">
            <button
              type="button"
              onClick={() => setRole('USER')}
              className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                role === 'USER'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Dependent (PwD)</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('CAREGIVER')}
              className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                role === 'CAREGIVER'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Parent / Caregiver</span>
            </button>
          </div>

          <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-error/10 text-error text-xs font-bold border border-error/20 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-name" className="text-xs font-extrabold text-on-surface">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                <input
                  id="signup-name"
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-email" className="text-xs font-extrabold text-on-surface">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                <input
                  id="signup-email"
                  type="email"
                  placeholder="priya@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-password" className="text-xs font-extrabold text-on-surface">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                <input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-13 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 mt-2"
            >
              <span>{isSubmitting ? 'Creating Account...' : 'Continue to Profile Setup'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center pt-2 border-t border-outline-variant/20 text-xs text-on-surface-variant font-medium">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-extrabold hover:underline">
              Log In
            </Link>
          </div>
        </div>
      ) : (
        <OnboardingWizard initialRole={role} onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}
