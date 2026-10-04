'use client';

import React, { useState } from 'react';
import { Sparkles, Mic } from 'lucide-react';
import VoiceAssistantModal from './VoiceAssistantModal';
import { triggerHapticCue } from '@/utils/haptics';

export interface TalkToAssistantButtonProps {
  variant?: 'fab' | 'banner' | 'inline';
  className?: string;
  onRouteCalculated?: (data: any) => void;
}

export default function TalkToAssistantButton({
  variant = 'fab',
  className = '',
  onRouteCalculated,
}: TalkToAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    const handleOpenEvent = (e: any) => {
      if (e?.detail?.prompt) {
        setInitialPrompt(e.detail.prompt);
      }
      setIsOpen(true);
    };

    window.addEventListener('pathfinder:open-voice-assistant', handleOpenEvent);
    return () => window.removeEventListener('pathfinder:open-voice-assistant', handleOpenEvent);
  }, []);

  const handleOpen = () => {
    triggerHapticCue('confirm');
    setInitialPrompt(undefined);
    setIsOpen(true);
  };

  if (variant === 'banner') {
    return (
      <>
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Talk to Voice AI Accessibility Assistant"
          className={`w-full py-3.5 px-4 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-3 shadow-lg hover:opacity-95 transition-all transform active:scale-98 ${className}`}
        >
          <Sparkles className="w-5 h-5 fill-current animate-spin" />
          <span>Talk to Voice Assistant</span>
          <Mic className="w-5 h-5 ml-auto" />
        </button>

        <VoiceAssistantModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onRouteCalculated={onRouteCalculated}
          initialPrompt={initialPrompt}
        />
      </>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Talk to Voice AI Accessibility Assistant"
          className={`px-4 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-all ${className}`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Talk to Assistant</span>
        </button>

        <VoiceAssistantModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onRouteCalculated={onRouteCalculated}
          initialPrompt={initialPrompt}
        />
      </>
    );
  }

  // Default: Floating Action Button (FAB)
  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Talk to Voice AI Accessibility Assistant (Press Space)"
        title="Talk to Voice AI Assistant"
        className={`fixed bottom-6 right-6 z-40 px-5 py-3.5 rounded-full bg-primary text-white font-black text-sm flex items-center gap-2.5 shadow-2xl hover:scale-105 transition-all border-2 border-white/20 active:scale-95 ${className}`}
      >
        <Sparkles className="w-5 h-5 fill-current animate-pulse text-amber-300" />
        <span className="tracking-wide">Talk to Assistant</span>
        <Mic className="w-4 h-4 ml-1" />
      </button>

      <VoiceAssistantModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onRouteCalculated={onRouteCalculated}
        initialPrompt={initialPrompt}
      />
    </>
  );
}
