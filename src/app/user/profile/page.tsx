'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccessibility, PersonaType } from '@/context/AccessibilityContext';
import {
  User,
  Accessibility,
  Footprints,
  Eye,
  Heart,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  Share2,
  AlertOctagon,
  ArrowRight,
  Sun,
  Moon,
  Volume2,
} from 'lucide-react';

export default function UserProfilePage() {
  const {
    user,
    persona,
    setPersona,
    speakText,
    isDarkMode,
    toggleDarkMode,
    isVoicePromptActive,
    toggleVoicePrompt,
    openOnboarding,
  } = useAccessibility();

  const [savedSuccess, setSavedSuccess] = useState(false);

  const personas: { id: PersonaType; title: string; desc: string; icon: React.ElementType }[] = [
    {
      id: 'wheelchair',
      title: 'Wheelchair Navigator',
      desc: 'Requires 100% step-free ramps, curb cuts, elevator priority, max 5% incline.',
      icon: Accessibility,
    },
    {
      id: 'older-adult',
      title: 'Older Adult / Gentle Mobility',
      desc: 'Prefers shaded sidewalks, resting benches, smooth terrain, minimal stairs.',
      icon: Footprints,
    },
    {
      id: 'low-vision',
      title: 'Low Vision / Blind Support',
      desc: 'High contrast visual cues, tactile paving guides, continuous audio voice guidance.',
      icon: Eye,
    },
    {
      id: 'caregiver',
      title: 'Companion / Caregiver Assist',
      desc: 'Wide path clearance, multi-person sidewalk routing, emergency guardian live sync.',
      icon: Heart,
    },
  ];

  const handleSelectPersona = (pId: PersonaType, title: string) => {
    setPersona(pId);
    speakText(`Mobility profile updated to ${title}`);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-[850px] flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-black shadow-md">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-on-surface tracking-tight">
                Mobility Profile
              </h1>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                Personalized accessibility routing and assistive preferences.
              </p>
            </div>
          </div>

          <Link
            href="/user/share"
            className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center gap-1.5 shadow-sm hover:opacity-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Pair with Caregiver</span>
          </Link>
        </div>

        {savedSuccess && (
          <div className="p-4 rounded-2xl bg-primary/10 text-primary border border-primary/30 flex items-center gap-2 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Mobility profile preferences updated successfully.</span>
          </div>
        )}

        {/* User Account Info Card */}
        <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center text-xl font-black shadow-md">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black text-on-surface">{user.name || 'Navigator User'}</span>
              <span className="text-xs text-on-surface-variant font-medium">{user.email || '—'}</span>
              <span className="text-[11px] text-secondary font-black uppercase mt-0.5">Role: Dependent Navigator</span>
            </div>
          </div>

          <button
            type="button"
            onClick={openOnboarding}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary font-extrabold text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>Re-run Voice Onboarding</span>
          </button>
        </div>

        {/* Mobility Profile Cards */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-black text-on-surface uppercase tracking-wider">
            Select Active Mobility Persona
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {personas.map(p => {
              const Icon = p.icon;
              const isSelected = persona === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPersona(p.id, p.title)}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-primary-container/20 border-primary shadow-md ring-2 ring-primary/20'
                      : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary text-on-primary uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-black text-on-surface">{p.title}</h3>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assistive Controls */}
        <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col gap-4">
          <h2 className="text-sm font-black text-on-surface uppercase tracking-wider">
            Quick Accessibility Toggles
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-3.5 rounded-2xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 flex items-center justify-between text-xs font-bold text-on-surface cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isDarkMode ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span>Night Mode</span>
              </div>
              <span className="text-[10px] text-primary font-black uppercase">{isDarkMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={toggleVoicePrompt}
              className="p-3.5 rounded-2xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 flex items-center justify-between text-xs font-bold text-on-surface cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Voice Prompts</span>
              </div>
              <span className="text-[10px] text-primary font-black uppercase">{isVoicePromptActive ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
