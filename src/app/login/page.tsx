'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import { safeFetchJson } from '@/lib/safeFetch';
import Logo from '@/components/Logo';
import {
  Navigation,
  ShieldCheck,
  User,
  ArrowRight,
  Mail,
  Lock,
  Phone,
  Globe,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  MapPin,
  Heart,
  Radio,
  Zap,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginUser, speakText } = useAccessibility();

  const [role, setRole] = useState<'CAREGIVER' | 'USER'>('USER');
  const [authMethod, setAuthMethod] = useState<'password' | 'otp' | 'google'>('password');

  // Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // OTP state
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRoleSelect = (selectedRole: 'CAREGIVER' | 'USER') => {
    setRole(selectedRole);
    setErrorMessage('');
    setSuccessMessage('');
    if (selectedRole === 'USER') {
      setEmail('demo.user@pathfinder.app');
      setPassword('demo1234');
      speakText('Selected Navigator User Portal');
    } else {
      setEmail('demo.caregiver@pathfinder.app');
      setPassword('demo1234');
      speakText('Selected Parent and Caregiver Guardian Portal');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (authMethod === 'password') {
        const loginEmail = email || (role === 'USER' ? 'demo.user@pathfinder.app' : 'demo.caregiver@pathfinder.app');
        const loginPassword = password || 'demo1234';

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginEmail, password: loginPassword, role }),
        });
        const data = await safeFetchJson(res);
        if (!res.ok) throw new Error(data.error || 'Authentication failed');

        await loginUser(loginEmail, loginPassword);
        speakText(`Welcome back ${data.user?.name || 'User'}.`);

        if (data.role === 'CAREGIVER') {
          router.push('/caregiver/map');
        } else {
          router.push('/user/map');
        }
      } else if (authMethod === 'otp') {
        if (!phone) throw new Error('Please enter a valid mobile number');

        if (!otpSent) {
          const res = await fetch('/api/auth/otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send', phone, role }),
          });
          const data = await safeFetchJson(res);
          if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

          setOtpSent(true);
          setSuccessMessage(data.demoOtp ? `Demo OTP code: ${data.demoOtp}` : 'OTP sent to mobile phone.');
          speakText('OTP code sent');
        } else {
          if (!otpCode) throw new Error('Please enter the 6-digit OTP code');

          const res = await fetch('/api/auth/otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', phone, code: otpCode, role }),
          });
          const data = await safeFetchJson(res);
          if (!res.ok) throw new Error(data.error || 'Invalid OTP code');

          speakText(`Welcome ${data.user?.name || 'User'}. Authenticated.`);

          if (data.role === 'CAREGIVER') {
            router.push('/caregiver/map');
          } else {
            router.push('/user/map');
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (demoRole: 'USER' | 'CAREGIVER') => {
    setIsSubmitting(true);
    setErrorMessage('');
    const demoEmail = demoRole === 'USER' ? 'demo.user@pathfinder.app' : 'demo.caregiver@pathfinder.app';
    const demoPass = 'demo1234';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPass, role: demoRole }),
      });
      const data = await safeFetchJson(res);
      if (!res.ok) throw new Error(data.error || 'Login failed');

      await loginUser(demoEmail, demoPass);
      if (demoRole === 'CAREGIVER') {
        router.push('/caregiver/map');
      } else {
        router.push('/user/map');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Quick login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-4 md:p-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 mb-8 text-center">
        <Logo size={64} className="mb-1 hover:scale-105" />
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-on-surface">
          PathFinder Access
        </h1>
        <p className="text-xs md:text-sm text-on-surface-variant font-bold max-w-md">
          Barrier-Free Urban Navigation & Two-Phone Live Caregiver Monitoring
        </p>
      </div>

      <div className="w-full max-w-4xl flex flex-col gap-8">
        {/* TWO BIG PORTAL CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: User / Dependent */}
          <div
            onClick={() => handleRoleSelect('USER')}
            className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-5 relative overflow-hidden shadow-lg ${
              role === 'USER'
                ? 'bg-primary-container/20 border-primary shadow-primary/10 ring-2 ring-primary/30'
                : 'bg-surface-container-lowest border-outline-variant/40 hover:border-primary/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-md">
                <User className="w-7 h-7" />
              </div>
              <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase ${
                role === 'USER' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {role === 'USER' ? 'Active Portal' : 'Select'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xl font-black text-on-surface tracking-tight">
                I am a User (Dependent)
              </h2>
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                Step-free wheelchair routing, high precision GPS navigation, live obstacle alerts, and one-tap SOS panic button.
              </p>
            </div>

            <div className="pt-3 border-t border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                <MapPin className="w-4 h-4" />
                <span>GPS & Mobility Core</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickDemoLogin('USER');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-secondary text-on-secondary text-xs font-extrabold shadow-sm hover:opacity-95 transition-opacity"
              >
                1-Click Demo User →
              </button>
            </div>
          </div>

          {/* Card 2: Parent / Caregiver */}
          <div
            onClick={() => handleRoleSelect('CAREGIVER')}
            className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-5 relative overflow-hidden shadow-lg ${
              role === 'CAREGIVER'
                ? 'bg-primary-container/20 border-primary shadow-primary/10 ring-2 ring-primary/30'
                : 'bg-surface-container-lowest border-outline-variant/40 hover:border-primary/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase ${
                role === 'CAREGIVER' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {role === 'CAREGIVER' ? 'Active Portal' : 'Select'}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xl font-black text-on-surface tracking-tight">
                I am a Parent / Caregiver
              </h2>
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                Live two-phone GPS tracking map, instant SOS emergency alerts with siren, route deviations, and safe zones.
              </p>
            </div>

            <div className="pt-3 border-t border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Radio className="w-4 h-4" />
                <span>Real-Time Guardian Stream</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickDemoLogin('CAREGIVER');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-extrabold shadow-sm hover:opacity-95 transition-opacity"
              >
                1-Click Demo Caregiver →
              </button>
            </div>
          </div>
        </div>

        {/* AUTHENTICATION FORM CARD */}
        <div className="w-full max-w-md mx-auto bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-xl p-6 md:p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-black text-primary uppercase tracking-wider">
              {role === 'USER' ? 'Navigator Account' : 'Caregiver Guardian Account'}
            </span>
            <h3 className="text-xl font-black text-on-surface">
              Log In to {role === 'USER' ? 'User Portal' : 'Caregiver Portal'}
            </h3>
          </div>

          {/* Auth Method Tabs */}
          <div className="flex border-b border-outline-variant/30 text-xs font-bold text-on-surface-variant">
            <button
              type="button"
              onClick={() => setAuthMethod('password')}
              className={`py-2 px-3 border-b-2 transition-all ${
                authMethod === 'password' ? 'border-primary text-primary' : 'border-transparent hover:text-on-surface'
              }`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('otp')}
              className={`py-2 px-3 border-b-2 transition-all ${
                authMethod === 'otp' ? 'border-primary text-primary' : 'border-transparent hover:text-on-surface'
              }`}
            >
              Phone OTP
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-error/10 text-error text-xs font-bold border border-error/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary text-xs font-bold border border-primary/20 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {authMethod === 'password' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-on-surface">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={email}
                    placeholder={role === 'USER' ? 'demo.user@pathfinder.app' : 'demo.caregiver@pathfinder.app'}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-on-surface">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    value={password}
                    placeholder="••••••••"
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 mt-1"
              >
                <span>{isSubmitting ? 'Authenticating...' : role === 'USER' ? 'Enter User Portal' : 'Enter Caregiver Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {authMethod === 'otp' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-on-surface">Mobile Phone (+91)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={otpSent}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {otpSent && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-on-surface">6-Digit OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full h-11 px-4 text-center tracking-widest text-lg font-bold rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 mt-1"
              >
                <span>{!otpSent ? 'Send OTP Code' : 'Verify & Enter Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-outline-variant/20 text-xs text-on-surface-variant">
            Need a new profile?{' '}
            <Link href="/signup" className="text-primary font-extrabold hover:underline">
              Create New Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
