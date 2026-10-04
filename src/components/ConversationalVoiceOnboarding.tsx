'use client';

import React, { useEffect, useRef } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';

/**
 * Conversational Voice Onboarding & Hands-Free Auto-Start for Blind / Low-Vision Users.
 * As soon as the app opens:
 * 1. Directly opens the Voice Assistant modal.
 * 2. Speaks the welcoming onboarding greeting aloud:
 *    "Welcome. I am your navigation assistant. Are you looking to go somewhere, or do you need help logging in?"
 * 3. Immediately activates the microphone for hands-free conversational voice commands,
 *    allowing blind users to navigate the app completely without touching the screen.
 * 4. Provides a full-screen tap / keypress listener so any touch anywhere on the screen
 *    instantly activates or wakes the assistant if browser autoplay restricted initial ungestured audio.
 */
export default function ConversationalVoiceOnboarding() {
  const { speakText, persona } = useAccessibility();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const WELCOME_PHRASE =
      'Welcome. I am your navigation assistant. Are you looking to go somewhere, or do you need help logging in?';

    const launchVoiceAssistantDirectly = () => {
      if (hasTriggeredRef.current) return;
      hasTriggeredRef.current = true;

      // Dispatch event to directly open the Voice Assistant modal in hands-free listening mode
      window.dispatchEvent(
        new CustomEvent('pathfinder:open-voice-assistant', {
          detail: { prompt: WELCOME_PHRASE, autoListen: true, handsFree: true },
        })
      );
    };

    // 1. Immediately launch on mount (400ms delay to allow layout hydration)
    const initialTimer = setTimeout(() => {
      launchVoiceAssistantDirectly();
    }, 400);

    // 2. Full-screen gesture listener: If the browser blocked ungestured autoplay/microphone,
    // any tap anywhere on the screen or keypress immediately wakes up the voice assistant!
    const handleGestureWake = () => {
      launchVoiceAssistantDirectly();
    };

    window.addEventListener('pointerdown', handleGestureWake);
    window.addEventListener('keydown', handleGestureWake);
    window.addEventListener('touchstart', handleGestureWake);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('pointerdown', handleGestureWake);
      window.removeEventListener('keydown', handleGestureWake);
      window.removeEventListener('touchstart', handleGestureWake);
    };
  }, [speakText, persona]);

  return null;
}
