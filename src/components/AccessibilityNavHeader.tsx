'use client';

import React from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import { Sun, Moon, Volume2, VolumeX, Sparkles, Navigation } from 'lucide-react';
import TalkToAssistantButton from './TalkToAssistantButton';

interface AccessibilityNavHeaderProps {
  currentStep?: number;
  onResetToForm?: () => void;
  onStartTour?: () => void;
}

export default function AccessibilityNavHeader({
  currentStep = 2,
  onResetToForm,
  onStartTour,
}: AccessibilityNavHeaderProps) {
  const {
    isDarkMode,
    toggleDarkMode,
    isHighContrast,
    toggleHighContrast,
    fontScale,
    setFontScale,
    isVoicePromptActive,
    toggleVoicePrompt,
    speakText,
  } = useAccessibility();

  return (
    <header
      id="top-nav-bar"
      role="banner"
      aria-label="Accessibility Navigation Header"
      className="sticky top-0 z-40 w-full backdrop-blur-md bg-surface/95 border-b border-outline-variant/30 shadow-sm transition-colors duration-200"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        
        {/* Left: Brand Logo & Theme Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onResetToForm}
            className="flex items-center gap-2.5 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
            title="pathFinder Home / Route Planner"
            aria-label="pathFinder logo, return to route planner form"
          >
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <Navigation className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-on-surface flex items-center gap-1.5">
                pathFinder
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
              </span>
              <span className="hidden sm:block text-[11px] font-bold text-on-surface-variant -mt-1 tracking-wide">
                WCAG AAA ACCESSIBLE
              </span>
            </div>
          </button>

          {/* Theme Toggle (Left) */}
          <button
            type="button"
            onClick={() => {
              toggleDarkMode();
              speakText(
                !isDarkMode
                  ? "Night mode enabled"
                  : "Day mode restored"
              );
            }}
            aria-label={`Toggle Theme Mode. Current: ${isDarkMode ? 'Night Mode' : 'Day Mode'}`}
            aria-pressed={isDarkMode}
            className={`px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
              isDarkMode
                ? 'bg-primary text-white border border-primary/40 shadow-md ring-2 ring-primary/40'
                : 'bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/40'
            }`}
          >
            {isDarkMode ? (
              <>
                <Moon className="w-4 h-4 text-white" aria-hidden="true" />
                <span>Night Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span>Day Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Center: Text Size Resizer T T T */}
        <div
          role="group"
          aria-label="Text size scaling controls"
          className="flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <span className="sr-only">Font size options:</span>
          
          <button
            type="button"
            onClick={() => {
              setFontScale('sm');
              speakText("Text size set to compact");
            }}
            aria-label="Small font size"
            aria-pressed={fontScale === 'sm'}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
              fontScale === 'sm'
                ? 'bg-purple-700 text-white shadow-sm font-extrabold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="text-xs" aria-hidden="true">T</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFontScale('md');
              speakText("Text size set to medium standard");
            }}
            aria-label="Medium font size (Standard)"
            aria-pressed={fontScale === 'md'}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
              fontScale === 'md'
                ? 'bg-purple-700 text-white shadow-sm font-extrabold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="text-sm" aria-hidden="true">T</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFontScale('lg');
              speakText("Text size set to large");
            }}
            aria-label="Large font size"
            aria-pressed={fontScale === 'lg'}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
              fontScale === 'lg'
                ? 'bg-purple-700 text-white shadow-sm font-extrabold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="text-base" aria-hidden="true">T</span>
          </button>
        </div>

        {/* Right: Voice Narrator Toggle & Tour Trigger */}
        <div className="flex items-center gap-2">
          {onStartTour && currentStep >= 3 && (
            <button
              type="button"
              onClick={onStartTour}
              className="hidden sm:flex px-3.5 py-2 rounded-full items-center gap-1.5 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restart Tour</span>
            </button>
          )}

          {/* Talk To Assistant Voice Trigger */}
          <TalkToAssistantButton variant="inline" />

          {/* Voice screen reader audio toggle */}
          <button
            type="button"
            onClick={toggleVoicePrompt}
            aria-pressed={isVoicePromptActive}
            aria-label={`Voice screen reader narration toggle. Currently ${isVoicePromptActive ? 'ON' : 'OFF'}`}
            className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
              isVoicePromptActive
                ? 'bg-purple-700 text-white ring-2 ring-purple-400 shadow-md'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            {isVoicePromptActive ? (
              <>
                <Volume2 className="w-4 h-4 text-white animate-pulse" aria-hidden="true" />
                <span>Voice: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span>Voice: OFF</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
}
