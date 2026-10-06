import { useCallback } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';

/**
 * Custom Hook for Text-to-Speech (TTS) Voice Announcements.
 * Reuses AccessibilityContext speech settings and falls back to window.speechSynthesis.
 */
export function useVoiceFeedback() {
  const { speakText, isVoicePromptActive } = useAccessibility();

  const speak = useCallback(
    (text: string, force = true, onEnd?: () => void) => {
      if (!text) {
        if (onEnd) onEnd();
        return;
      }
      if (speakText) {
        speakText(text, force, onEnd);
      } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        if (onEnd) {
          utterance.onend = () => onEnd();
          utterance.onerror = () => onEnd();
        }
        window.speechSynthesis.speak(utterance);
      } else {
        if (onEnd) onEnd();
      }
    },
    [speakText]
  );

  return {
    speakText: speak,
    isVoicePromptActive,
  };
}
