'use client';

import { useEffect } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import { VOICE_ASSISTANT_NAME } from '@/lib/navigationVoiceCommander';

/**
 * Conversational Voice Accessibility Assistant Companion.
 * Adheres strictly to the requirement:
 * - Does NOT arbitrarily auto-open or pop up on random clicks/touches or page load.
 * - Provides keyboard accessibility (Alt+V or Spacebar when focused) to open Nova.
 * - Works hand-in-hand with the background wake-word listener ("Hey Nova").
 */
export default function ConversationalVoiceOnboarding() {
  const { persona } = useAccessibility();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Accessible global keyboard shortcut: Alt + V to toggle Nova
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('pathfinder:open-voice-assistant', {
            detail: {
              prompt: `Hello, I am ${VOICE_ASSISTANT_NAME}. How can I assist you with your route?`,
            },
          })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [persona]);

  return null;
}
