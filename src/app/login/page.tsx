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
  ShieldCheck,
  AlertCircle,
  User,
  Users,
  CheckCircle2,
  Heart,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginUser, speakText } = useAccessibility();

  const [role, setRole] = useState<'navigator' | 'parent'>('parent');
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
      speakText(`Welcome back ${loggedUser.name || 'User'}.`);

      // Redirect based on selected role
      if (role === 'parent' || loggedUser.role === 'parent') {
        router.push('/parent-dashboard');
      } else if (loggedUser.hasCompletedProfile) {
        router.push('/safety-routing');
      } else {
        router.push('/signup');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email address or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (targetRole: 'parent' | 'navigator') => {
    if (targetRole === 'parent') {
      setEmail('parent@community.org');
      setPassword('password123');
      setRole('parent');
    } else {
      setEmail('alex.rivera@community.org');
      setPassword('password123');
      setRole('navigator');
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
            Pixel Muse Safety
          </span>
          <span className="text-[11px] text-on-surface-variant font-extrabold uppercase tracking-wider">
            Barrier-Free & Parent Monitoring Portal
          </span>
        </div>
      </Link>

      {/* Login Card */}
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-xl p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-black text-on-surface tracking-tight">
            Log In to Pixel Muse
          </h1>
          <p className="text-xs text-on-surface-variant font-medium">
            Select your account role to access your personalized dashboard.
          </p>
        </div>

        {/* ROLE SELECTION TABS */}
        <div className="p-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRole('parent');
              speakText('Selected Parent and Caregiver account role');
            }}
            className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              role === 'parent'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Parent / Caregiver</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRole('navigator');
              speakText('Selected Navigator account role');
            }}
            className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              role === 'navigator'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Navigator (PWD / Child)</span>
          </button>
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
                placeholder={role === 'parent' ? 'parent@community.org' : 'alex.rivera@community.org'}
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
            <span>{isSubmitting ? 'Authenticating...' : role === 'parent' ? 'Log In to Guardian Dashboard' : 'Log In to Navigator Portal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="flex flex-col gap-2 pt-3 border-t border-outline-variant/20">
          <span className="text-[11px] font-extrabold text-on-surface-variant uppercase text-center">
            One-Click Demo Accounts:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('parent')}
              className="p-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-[11px] font-bold text-on-surface flex items-center justify-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Parent / Caregiver</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('navigator')}
              className="p-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-[11px] font-bold text-on-surface flex items-center justify-center gap-1 cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-secondary" />
              <span>Navigator (PWD)</span>
            </button>
          </div>
        </div>

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

