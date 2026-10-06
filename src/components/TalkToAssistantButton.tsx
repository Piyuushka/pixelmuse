'use client';

import React from 'react';
import { Sparkles, Mic, MicOff } from 'lucide-react';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { triggerHapticCue } from '@/utils/haptics';

export interface TalkToAssistantButtonProps {
  variant?: 'fab' | 'banner' | 'inline';
  className?: string;
  onRouteCalculated?: (data: Record<string, unknown>) => void;
}

export default function TalkToAssistantButton({
  variant = 'fab',
  className = '',
}: TalkToAssistantButtonProps) {
  const { openAssistant, wakeWordName, voiceState, statusText } = useVoiceAssistant();

  const handleOpen = () => {
    triggerHapticCue('confirm');
    openAssistant();
  };

  if (variant === 'banner') {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Talk to ${wakeWordName} Accessibility Voice Assistant (or say 'Hey ${wakeWordName}')`}
        className={`w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-between gap-3 shadow-lg hover:opacity-95 transition-all transform active:scale-98 cursor-pointer ${className}`}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 fill-current animate-spin" />
          <span>Talk to {wakeWordName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold opacity-80 bg-white/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                voiceState === 'CLOSED_WAKE_LISTENING'
                  ? 'bg-emerald-300 animate-pulse'
                  : 'bg-white/60'
              }`}
            />
            {statusText}
          </span>
          <Mic className="w-5 h-5" />
        </div>
      </button>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Talk to ${wakeWordName} Voice Assistant`}
        title={`Say "Hey ${wakeWordName}" or click to talk`}
        className={`px-4 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-all cursor-pointer ${className}`}
      >
        <Sparkles className="w-4 h-4" />
        <span>Talk to {wakeWordName}</span>
        <span className="text-[10px] opacity-80 font-bold bg-white/20 px-1.5 py-0.5 rounded-md hidden md:inline">
          {voiceState === 'CLOSED_WAKE_LISTENING' ? `"Hey ${wakeWordName}"` : statusText}
        </span>
      </button>
    );
  }

  // Default: Floating Action Button (FAB)
  return (
    <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end gap-1.5 ${className}`}>
      {/* Live Voice Status Pill above FAB */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-highest/95 backdrop-blur-md border border-outline-variant/40 text-[11px] font-extrabold text-on-surface shadow-md animate-fade-in">
        <span
          className={`w-2 h-2 rounded-full ${
            voiceState === 'CLOSED_WAKE_LISTENING'
              ? 'bg-emerald-500 animate-pulse'
              : voiceState === 'OPEN_COMMAND_LISTENING'
              ? 'bg-emerald-500 animate-bounce'
              : voiceState === 'SPEAKING'
              ? 'bg-purple-500 animate-pulse'
              : voiceState === 'PROCESSING'
              ? 'bg-blue-500 animate-pulse'
              : voiceState === 'MIC_UNAVAILABLE'
              ? 'bg-rose-500'
              : 'bg-amber-400'
          }`}
        />
        <span>{statusText}</span>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Talk to ${wakeWordName} Accessibility Assistant (or say 'Hey ${wakeWordName}')`}
        title={`Say "Hey ${wakeWordName}" or click to talk`}
        className="px-5 py-3.5 rounded-full bg-primary text-white font-black text-sm flex items-center gap-2.5 shadow-2xl hover:scale-105 transition-all border-2 border-white/20 active:scale-95 cursor-pointer"
      >
        <Sparkles className="w-5 h-5 fill-current animate-pulse text-amber-300" />
        <span className="tracking-wide">Talk to {wakeWordName}</span>
        <span className="hidden sm:inline text-[11px] font-bold opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
          &quot;Hey {wakeWordName}&quot;
        </span>
        {voiceState === 'MIC_UNAVAILABLE' ? (
          <MicOff className="w-4 h-4 ml-1 text-rose-300" />
        ) : (
          <Mic
            className={`w-4 h-4 ml-1 ${
              voiceState === 'CLOSED_WAKE_LISTENING' || voiceState === 'OPEN_COMMAND_LISTENING'
                ? 'text-emerald-300'
                : ''
            }`}
          />
        )}
      </button>
    </div>
  );
}
