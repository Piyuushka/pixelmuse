'use client';

import React from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import Logo from '@/components/Logo';
import {
  Navigation,
  Sparkles,
  Accessibility,
  SlidersHorizontal,
  Volume2,
  ArrowRight,
  User,
  ShieldCheck,
  CheckCircle2,
  Compass,
  MapPin,
} from 'lucide-react';

export default function LandingPage() {
  const { openOnboarding, user } = useAccessibility();

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Top Navbar */}
      <header className="w-full px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Logo size={42} className="hover:scale-105" />
          <div className="flex flex-col py-1">
            <span className="text-xl sm:text-2xl font-black text-on-surface tracking-tight leading-normal">
              PathFinder Access
            </span>
            <span className="text-[11px] sm:text-xs text-on-surface-variant font-extrabold uppercase tracking-wider">
              Accessible Navigation Core
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.isLoggedIn ? (
            <>
              <span className="text-xs font-bold text-on-surface-variant hidden sm:inline">
                Welcome, <span className="text-on-surface font-extrabold">{user.name || 'Navigator'}</span>
              </span>
              <Link
                href="/gps-precision"
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-black shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Compass className="w-4 h-4" />
                <span>Go to Navigation Dashboard →</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-xs font-extrabold text-on-surface transition-colors"
              >
                Log In
              </Link>

              <Link
                href="/signup"
                className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-black shadow-sm hover:opacity-90 transition-opacity"
              >
                Sign Up & Set Profile
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col gap-10 md:gap-14 text-center items-center justify-center">
        
        {/* Badge & Title */}
        <div className="flex flex-col items-center gap-6 max-w-4xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-black shadow-sm">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>WCAG AAA Accessible Community Navigation</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-on-surface tracking-tight leading-[1.1]">
            Barrier-Free Navigation <br className="hidden md:block" />
            <span className="text-primary mt-2 block md:inline md:mt-0">Tailored to Your Mobility</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-on-surface-variant font-medium leading-relaxed max-w-3xl mx-auto mt-4 px-2">
            Precision GPS guidance, real-time crowdsourced barrier alerts, and custom step-free route recommendations calibrated to your exact physical requirements.
          </p>
        </div>

        {/* Primary Call-to-Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-2xl mx-auto mt-2">
          {user.isLoggedIn ? (
            <>
              <Link
                href="/gps-precision"
                className="w-full sm:w-auto flex-1 min-h-[3.5rem] py-3 px-6 rounded-2xl bg-primary text-on-primary font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-opacity"
              >
                <Compass className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span>Open GPS Precision Map</span>
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              </Link>

              <Link
                href="/micro-navigation"
                className="w-full sm:w-auto flex-1 min-h-[3.5rem] py-3 px-6 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 text-on-surface font-extrabold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span>Micro-Nav HUD</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/signup"
                className="w-full sm:w-auto flex-1 min-h-[3.5rem] py-3 px-6 rounded-2xl bg-primary text-on-primary font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-opacity"
              >
                <span>Create Account & Setup Profile</span>
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
              </Link>

              <Link
                href="/login"
                className="w-full sm:w-auto flex-1 min-h-[3.5rem] py-3 px-6 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/50 text-on-surface font-extrabold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors"
              >
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span>Log In</span>
              </Link>
            </>
          )}
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 w-full max-w-6xl mx-auto pt-8 md:pt-12 text-center">
          <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Accessibility className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-on-surface leading-tight">Step-Free Guarantees</h2>
            <p className="text-sm sm:text-base text-on-surface-variant font-medium leading-relaxed">
              Guaranteed ramp, elevator & curb-cut routing. Never get trapped by an unexpected flight of stairs again.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
              <SlidersHorizontal className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-on-surface leading-tight">Slope & Incline Tolerances</h2>
            <p className="text-sm sm:text-base text-on-surface-variant font-medium leading-relaxed">
              Customize maximum slope limits (3% to 15% grade) to filter out steep hills and strenuous ramps.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center">
              <Volume2 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-on-surface leading-tight">Spoken Voice Navigation</h2>
            <p className="text-sm sm:text-base text-on-surface-variant font-medium leading-relaxed">
              Auditory crossing cues and turn-by-turn spoken guidance for visually impaired and low-vision navigators.
            </p>
          </div>
        </div>

        {/* Quick Link to Dashboard */}
        <div className="pt-6 pb-8">
          <Link
            href="/gps-precision"
            className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-primary hover:underline underline-offset-4"
          >
            <span>Launch GPS Precision Map & Navigation Dashboard →</span>
          </Link>
        </div>

      </main>
    </div>
  );
}
