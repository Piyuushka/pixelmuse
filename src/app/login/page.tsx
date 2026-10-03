'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  Navigation,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  User,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginUser, speakText } = useAccessibility();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const loggedUser = await loginUser(email, password);
      speakText(`Welcome back ${loggedUser.name || 'Navigator'}. Loading your saved accessibility profile.`);

      // If user profile is already complete, go to Dashboard; else go to Profile Setup
      if (loggedUser.hasCompletedProfile) {
        router.push('/');
      } else {
        router.push('/signup');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email address or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6">
      {/* Top Logo */}
      <Link href="/landing" className="flex items-center gap-3 mb-8 group">
        <div className="w-11 h-11 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
          <Navigation className="w-6 h-6 text-white fill-current" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-black text-on-surface tracking-tight">
            PathFinder Access
          </span>
          <span className="text-[11px] text-on-surface-variant font-extrabold uppercase tracking-wider">
            Barrier-Free Navigation Core
          </span>
        </div>
      </Link>

      {/* Login Card */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-xl p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-black text-on-surface tracking-tight">
            Log In to Your Account
          </h1>
          <p className="text-xs text-on-surface-variant font-medium">
            Access your saved accessibility profile, route parameters, and community barrier reports.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-error/10 text-error text-xs font-bold border border-error/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-extrabold text-on-surface">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
              <input
                id="login-email"
                type="email"
                placeholder="e.g. alex.rivera@community.org"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-xs font-extrabold text-on-surface">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-13 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 mt-2"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Log In & Open Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-outline-variant/20 text-xs text-on-surface-variant font-medium">
          Don&apos;t have an account yet?{' '}
          <Link href="/signup" className="text-primary font-extrabold hover:underline">
            Sign Up & Setup Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
