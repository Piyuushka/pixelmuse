'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Volume2, X, Navigation, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { triggerHapticCue } from '@/utils/haptics';
import { useAccessibility } from '@/context/AccessibilityContext';
import Badge from './ui/Badge';

export interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteCalculated?: (data: any) => void;
}

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  onRouteCalculated,
}: VoiceAssistantModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const { speakText } = useVoiceFeedback();
  const { persona, isHighContrast } = useAccessibility();
  const recognitionRef = useRef<any>(null);

  // Announce modal opening for screen readers & TTS
  useEffect(() => {
    if (isOpen) {
      triggerHapticCue('confirm');
      speakText("Voice Assistant active. Say your destination, for example: take me to Central Library.");
      startListening();
    } else {
      stopListening();
      setTranscript('');
      setAssistantResponse(null);
      setErrorMessage('');
    }
  }, [isOpen]);

  // Keyboard shortcut: Spacebar to toggle microphone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (isListening) {
          stopListening();
        } else {
          startListening();
        }
      } else if (e.code === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListening]);

  const processSpokenText = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/assistant/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToProcess,
          userPersona: persona,
        }),
      });

      const data = await res.json();
      setIsProcessing(false);

      if (data.success) {
        setAssistantResponse(data);
        triggerHapticCue(data.hapticCue || 'confirm');
        speakText(data.spokenResponse);

        if (onRouteCalculated) {
          onRouteCalculated(data);
        }
      } else {
        setErrorMessage(data.error || 'Could not understand request.');
        speakText("Sorry, I could not understand. Please try saying take me to Central Library.");
        triggerHapticCue('error');
      }
    } catch (err) {
      setIsProcessing(false);
      setErrorMessage('Network connection error.');
      speakText("Network error. Please try again.");
      triggerHapticCue('error');
    }
  };

  const startListening = useCallback(() => {
    setErrorMessage('');
    setTranscript('');
    triggerHapticCue('confirm');

    // Check for Web Speech API in browser
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const text = event.results[current][0].transcript;
          setTranscript(text);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (e) {
        console.warn('SpeechRecognition initialization error:', e);
      }
    }

    // Fallback simulation for environments without Web Speech API
    setIsListening(true);
    const samplePhrases = [
      'Take me to Central Library',
      'Find a step free path to Cardiology Pavilion',
      'Navigate to Dadar Station wheelchair entrance',
    ];
    const chosenPhrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];

    let charIndex = 0;
    const interval = setInterval(() => {
      charIndex += 4;
      setTranscript(chosenPhrase.slice(0, charIndex));
      if (charIndex >= chosenPhrase.length) {
        clearInterval(interval);
        setIsListening(false);
      }
    }, 150);
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Voice AI Accessibility Assistant"
    >
      <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border flex flex-col gap-5 ${
        isHighContrast
          ? 'bg-black text-white border-white'
          : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface'
      }`}>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary animate-spin" />
            <h2 className="font-headline text-lg font-black tracking-wide">
              Voice AI Accessibility Assistant
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Voice Assistant"
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X className="w-6 h-6 text-on-surface-variant" />
          </button>
        </div>

        {/* Accessibility Profile Pill */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-on-surface-variant">
            Active Mode: <strong className="text-primary capitalize">{persona}</strong>
          </span>
          <Badge variant="success" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
            Step-Free Priority
          </Badge>
        </div>

        {/* Central Pulsing Mic Action Area */}
        <div className="flex flex-col items-center justify-center py-6 gap-4">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            aria-label={isListening ? 'Stop listening' : 'Tap or press Space to Speak'}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-xl ${
              isListening
                ? 'bg-primary text-white ring-8 ring-primary/30 animate-pulse'
                : 'bg-surface-container-high text-primary border-2 border-primary hover:bg-primary/10'
            }`}
          >
            {isListening ? (
              <Mic className="w-12 h-12 animate-bounce" />
            ) : (
              <MicOff className="w-12 h-12 opacity-80" />
            )}
          </button>

          <p className="text-xs font-bold text-on-surface-variant text-center">
            {isListening ? 'Listening... Speak your request' : 'Tap microphone or press Spacebar to talk'}
          </p>
        </div>

        {/* Live Transcript Box */}
        {transcript && (
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2">
            <span className="text-[11px] font-extrabold uppercase text-primary tracking-wider">
              You Spoke:
            </span>
            <p className="text-base font-bold text-on-surface leading-snug">
              "{transcript}"
            </p>
            {!isListening && !isProcessing && (
              <button
                onClick={() => processSpokenText(transcript)}
                className="mt-2 h-11 w-full rounded-xl bg-primary text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-primary/90"
              >
                <Navigation className="w-4 h-4 fill-current" />
                <span>Compute Accessible Route</span>
              </button>
            )}
          </div>
        )}

        {/* Processing Spinner */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-3 py-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-primary">
              Gemini AI calculating step-free route...
            </span>
          </div>
        )}

        {/* AI Response Display */}
        {assistantResponse && (
          <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-primary uppercase">
                Destination Found: {assistantResponse.destination}
              </span>
              <span className="text-xs font-extrabold text-secondary">
                {assistantResponse.metrics?.isStepFree ? '✓ 100% Step-Free' : 'Accessible'}
              </span>
            </div>
            <p className="text-sm font-bold text-on-surface">
              {assistantResponse.spokenResponse}
            </p>

            {/* Turn by turn voice steps preview */}
            {assistantResponse.navigationSteps && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-primary/20">
                {assistantResponse.navigationSteps.map((step: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                    <span>• {step.instruction}</span>
                    <button
                      onClick={() => {
                        triggerHapticCue(step.cue);
                        speakText(step.instruction);
                      }}
                      className="text-primary hover:underline text-[11px] font-bold"
                    >
                      <Volume2 className="w-3.5 h-3.5 inline mr-1" /> Listen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Voice Command Suggestions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/20">
          <span className="text-[11px] font-extrabold text-on-surface-variant w-full">Try saying:</span>
          {['Take me to Central Library', 'Step free route to Dadar Station', 'Find elevator entrance'].map((sample, i) => (
            <button
              key={i}
              onClick={() => {
                setTranscript(sample);
                processSpokenText(sample);
              }}
              className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-primary/20 text-xs font-bold text-on-surface transition-colors"
            >
              "{sample}"
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
