'use client';

import React from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import { Contrast, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react';

export default function AccessibilityToolbar() {
  const {
    isHighContrast,
    toggleHighContrast,
    isSimpleMode,
    toggleSimpleMode,
    fontScale,
    setFontScale,
    isVoicePromptActive,
    toggleVoicePrompt,
    speakText,
  } = useAccessibility();

  return (
    <div className="w-full bg-surface-container-low py-3 px-4 md:px-8 border-b border-outline-variant/30 shadow-xs" role="region" aria-label="Accessibility Settings Bar">
      <div className="max-w-[1000px] mx-auto flex items-center justify-between gap-3 flex-wrap">
        
        {/* Simple Mode Toggle */}
        <button
          onClick={toggleSimpleMode}
          type="button"
          aria-pressed={isSimpleMode}
          aria-label="Toggle Simple Mode with larger buttons and simplified controls"
          className={`min-h-[44px] px-4 rounded-xl flex items-center gap-2 font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
            isSimpleMode
              ? 'bg-amber-600 text-white ring-2 ring-amber-600 shadow-md'
              : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5 text-current shrink-0" />
          <span>{isSimpleMode ? 'Simple Mode: ON' : 'Simple Mode'}</span>
        </button>

        {/* Contrast Toggle */}
        <button
          onClick={() => {
            toggleHighContrast();
            speakText(isHighContrast ? "Standard contrast mode enabled" : "High contrast display mode enabled");
          }}
          type="button"
          aria-pressed={isHighContrast}
          aria-label="Toggle High Contrast Display Mode"
          className={`min-h-[44px] px-4 rounded-xl flex items-center gap-2 font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
            isHighContrast
              ? 'bg-primary text-on-primary ring-2 ring-primary shadow-md'
              : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
          }`}
        >
          <Contrast className="w-5 h-5 text-primary text-current shrink-0" />
          <span>{isHighContrast ? 'High Contrast: ON' : 'High Contrast'}</span>
        </button>

        {/* Font Scaler Group - 44px min touch targets */}
        <div
          role="group"
          aria-label="Text scaling controls"
          className="flex items-center p-1 rounded-xl bg-surface-container border border-outline-variant/30 gap-1"
        >
          <button
            type="button"
            onClick={() => {
              setFontScale('sm');
              speakText("Font scale set to compact");
            }}
            aria-label="Compact font scale"
            aria-pressed={fontScale === 'sm'}
            className={`min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              fontScale === 'sm'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-black'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="text-xs font-semibold">T-</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFontScale('md');
              speakText("Font scale set to default standard");
            }}
            aria-label="Medium font scale (Standard)"
            aria-pressed={fontScale === 'md'}
            className={`min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              fontScale === 'md'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-black'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="text-sm font-bold">T</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFontScale('lg');
              speakText("Font scale set to extra large");
            }}
            aria-label="Large font scale"
            aria-pressed={fontScale === 'lg'}
            className={`min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center font-bold text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              fontScale === 'lg'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-black'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="text-base font-black">T+</span>
          </button>
        </div>

        {/* Voice Guidance Toggle */}
        <button
          type="button"
          onClick={toggleVoicePrompt}
          aria-pressed={isVoicePromptActive}
          aria-label="Toggle spoken voice turn-by-turn guidance"
          className={`min-h-[44px] px-4 rounded-xl flex items-center gap-2 font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
            isVoicePromptActive
              ? 'bg-secondary text-on-secondary shadow-md ring-2 ring-secondary'
              : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
          }`}
        >
          {isVoicePromptActive ? (
            <Volume2 className="w-5 h-5 animate-pulse text-current shrink-0" />
          ) : (
            <VolumeX className="w-5 h-5 text-on-surface-variant shrink-0" />
          )}
          <span>{isVoicePromptActive ? 'Voice Guidance: ON' : 'Voice Prompt'}</span>
        </button>

      </div>
    </div>
  );
}
