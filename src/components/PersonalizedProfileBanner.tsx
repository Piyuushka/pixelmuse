'use client';

import React from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import Logo from './Logo';
import {
  User,
  Sliders,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Edit3,
  SlidersHorizontal,
  Volume2,
  ArrowRight,
  LogIn,
} from 'lucide-react';

export default function PersonalizedProfileBanner() {
  const {
    user,
    accessibilityPreferences,
    openOnboarding,
    persona,
  } = useAccessibility();

  if (!user.isLoggedIn || !user.hasCompletedProfile) {
    return (
      <div className="w-full p-5 rounded-3xl bg-gradient-to-r from-primary/10 via-secondary/10 to-surface-container-low border border-primary/20 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Logo size={44} className="flex-shrink-0" />
          <div className="flex flex-col gap-0.5">
            <div className="text-xs font-black text-primary uppercase tracking-wider">
              Welcome to PathFinder Access
            </div>
            <p className="text-xs font-bold text-on-surface">
              Log in or set up your accessibility profile for step-free guarantees, slope filtering & voice prompts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0 w-full md:w-auto">
          <Link
            href="/landing"
            className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-bold transition-colors"
          >
            Landing Page
          </Link>

          <Link
            href="/login"
            className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-on-surface text-xs font-extrabold flex items-center gap-1.5 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5 text-primary" />
            <span>Log In</span>
          </Link>

          <Link
            href="/signup"
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-black text-xs flex items-center gap-1.5 shadow-xs hover:opacity-90 transition-opacity"
          >
            <span>Sign Up & Set Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const personaLabelMap: Record<string, string> = {
    wheelchair: 'Wheelchair User',
    'older-adult': 'Older Adult',
    'low-vision': 'Low Vision',
    caregiver: 'Caregiver / Stroller',
  };

  return (
    <div className="w-full p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-xs flex-shrink-0 font-black text-sm">
          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-on-surface">
              Welcome back, {user.name || 'Navigator'}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 border border-emerald-600/30 text-[11px] font-black">
              <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              <span>Profile Active</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs text-on-surface-variant font-medium">
            <span className="font-extrabold text-on-surface">
              {personaLabelMap[persona] || persona}
            </span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 text-[11px] font-bold text-on-surface">
              {accessibilityPreferences.requireStepFree ? 'Step-Free Only' : 'Ramp Preferred'}
            </span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 text-[11px] font-bold text-on-surface">
              ≤ {accessibilityPreferences.maxSlopePercent}% Slope
            </span>
            {accessibilityPreferences.preferSaferCrossings && (
              <>
                <span>·</span>
                <span className="px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 text-[11px] font-bold text-on-surface">
                  Safer Crossings
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={openOnboarding}
        className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer flex-shrink-0"
      >
        <Edit3 className="w-3.5 h-3.5 text-primary" />
        <span>Edit Accessibility Profile</span>
      </button>
    </div>
  );
}
