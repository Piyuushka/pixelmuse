import { useCallback } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';

/**
 * Custom Hook for Text-to-Speech (TTS) Voice Announcements.
 * Reuses AccessibilityContext speech settings and falls back to window.speechSynthesis.
 */
export function useVoiceFeedback() {
  const { speakText, isVoicePromptActive } = useAccessibility();

  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      if (speakText) {
        speakText(text);
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    },
    [speakText]
  );

  return {
    speakText: speak,
    isVoicePromptActive,
  };
}
