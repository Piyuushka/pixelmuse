'use client';

import React, { useEffect, useState } from 'react';
import { Compass, Sparkles, Footprints, ShieldCheck, ArrowRight } from 'lucide-react';
import Logo from './Logo';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // 2.5s timer for splash screen transition
    const timer = setTimeout(() => {
      setIsFading(true);
      const completeTimer = setTimeout(() => {
        onComplete();
      }, 500); // 500ms fade transition
      return () => clearTimeout(completeTimer);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      role="region"
      aria-label="Welcome Splash Screen"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-950 text-white transition-opacity duration-500 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Decorative background glow circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center p-6 max-w-lg mx-auto">
        {/* Logo / Accessibility Path Symbol */}
        <div className="relative mb-6">
          <Logo size={112} className="shadow-2xl shadow-purple-500/40 ring-4 ring-white/20 animate-bounce rounded-3xl" />
          <div className="absolute -bottom-2 -right-2 bg-purple-400 text-purple-950 p-2 rounded-xl shadow-lg font-bold text-xs flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-purple-950" />
            <span>WCAG AAA</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-200 mb-3">
          pathFinder
        </h1>

        {/* Tagline */}
        <p className="text-lg sm:text-xl font-medium text-purple-200/90 mb-8 max-w-md leading-relaxed">
          &ldquo;Guiding your accessible journey.&rdquo;
        </p>

        {/* Animated Loading Bar */}
        <div className="w-48 h-2 bg-purple-950/60 rounded-full overflow-hidden border border-purple-400/30 mb-8">
          <div className="h-full bg-gradient-to-r from-purple-400 to-indigo-300 animate-[pulse_1.5s_infinite] w-full rounded-full transition-all" />
        </div>

        {/* Skip button for screen readers & fast navigation */}
        <button
          onClick={() => {
            setIsFading(true);
            setTimeout(onComplete, 200);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-purple-100 text-sm font-semibold backdrop-blur-sm border border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-purple-300"
          aria-label="Skip splash screen and proceed to Route Planner Onboarding Form"
        >
          <span>Skip to Route Planner</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
