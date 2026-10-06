'use client';

import React from 'react';
import { useAccessibility, FontScale } from '@/context/AccessibilityContext';
import { Contrast, Volume2, VolumeX, Type } from 'lucide-react';

export default function AccessibilityToolbar() {
  const {
    isHighContrast,
    toggleHighContrast,
    fontScale,
    setFontScale,
    isVoicePromptActive,
    toggleVoicePrompt,
    speakText
  } = useAccessibility();

  return (
    <div className="w-full bg-surface-container-low py-3 px-4 md:px-8 border-b border-outline-variant/30 shadow-xs">
      <div className="max-w-[900px] mx-auto flex items-center justify-between gap-3 flex-wrap">
        
        {/* Contrast Toggle */}
        <button
          onClick={() => {
            toggleHighContrast();
            speakText(isHighContrast ? "Standard contrast mode enabled" : "High contrast display mode enabled");
          }}
          type="button"
          aria-label="Toggle High Contrast Display Mode"
          className={`h-11 px-4 rounded-xl flex items-center gap-2 font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
            isHighContrast
              ? 'bg-primary text-on-primary ring-2 ring-primary shadow-md'
              : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
          }`}
        >
          <Contrast className="w-5 h-5 text-primary text-current" />
          <span>{isHighContrast ? 'High Contrast: ON' : 'High Contrast'}</span>
        </button>

        {/* Font Scaler Group */}
        <div
          role="group"
          aria-label="Text scaling controls"
          className="flex items-center p-1 rounded-xl bg-surface-container border border-outline-variant/30"
        >
          <button
            type="button"
            onClick={() => {
              setFontScale('sm');
              speakText("Font scale set to compact");
            }}
            aria-label="Compact font scale"
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              fontScale === 'sm'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-extrabold'
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
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              fontScale === 'md'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-extrabold'
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
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              fontScale === 'lg'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-extrabold'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="text-base font-extrabold">T+</span>
          </button>
        </div>

        {/* Voice Guidance Toggle */}
        <button
          type="button"
          onClick={toggleVoicePrompt}
          aria-pressed={isVoicePromptActive}
          className={`h-11 px-4 rounded-xl flex items-center gap-2 font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
            isVoicePromptActive
              ? 'bg-secondary text-on-secondary shadow-md ring-2 ring-secondary'
              : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
          }`}
        >
          {isVoicePromptActive ? (
            <Volume2 className="w-5 h-5 animate-pulse text-current" />
          ) : (
            <VolumeX className="w-5 h-5 text-on-surface-variant" />
          )}
          <span>{isVoicePromptActive ? 'Voice Guidance: ON' : 'Voice Prompt'}</span>
        </button>

      </div>
    </div>
  );
}
