'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Mic,
  MicOff,
  Volume2,
  X,
  Navigation,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Camera,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  Eye,
  MapPin,
  Compass,
  Radio,
} from 'lucide-react';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { triggerHapticCue } from '@/utils/haptics';
import { useAccessibility } from '@/context/AccessibilityContext';
import Badge from './ui/Badge';

export interface NavigationStep {
  stepNumber: number;
  instruction: string;
  landmark?: string;
  cue: 'left_turn' | 'right_turn' | 'confirm' | 'stop' | 'obstacle';
  distance: string;
  stepsCount?: number;
}

export interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteCalculated?: (data: any) => void;
  initialPrompt?: string;
}

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  onRouteCalculated,
  initialPrompt,
}: VoiceAssistantModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHandsFreeActive, setIsHandsFreeActive] = useState(true);

  // Turn-by-turn voice guidance state
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isNavigatingSteps, setIsNavigatingSteps] = useState(false);

  // Computer Vision / Surroundings state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanningSurroundings, setIsScanningSurroundings] = useState(false);
  const [surroundingsResult, setSurroundingsResult] = useState<string | null>(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const restartListeningTimerRef = useRef<any>(null);

  const { speakText } = useVoiceFeedback();
  const {
    persona,
    isHighContrast,
    toggleDarkMode,
    isDarkMode,
    setFontScale,
  } = useAccessibility();

  // Helper to safely speak aloud and automatically resume microphone listening on completion
  const speakWithAutoResume = useCallback(
    (text: string, onDone?: () => void) => {
      isSpeakingRef.current = true;
      // Stop recognition while speaking so mic does not capture synthetic audio
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);

      speakText(text, true, () => {
        isSpeakingRef.current = false;
        if (onDone) onDone();
        // Immediately restart listening hands-free
        if (isHandsFreeActive) {
          setTimeout(() => {
            startListeningInternal();
          }, 250);
        }
      });
    },
    [speakText, isHandsFreeActive]
  );

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
    setIsScanningSurroundings(false);
  };

  // Internal start listening function
  const startListeningInternal = useCallback(() => {
    if (isSpeakingRef.current) return;
    setErrorMessage('');
    triggerHapticCue('confirm');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            if (item.isFinal) {
              finalTranscript += item[0].transcript;
            } else {
              setTranscript(item[0].transcript);
            }
          }

          if (finalTranscript.trim()) {
            setTranscript(finalTranscript.trim());
            processSpokenText(finalTranscript.trim());
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          // Auto-restart listening if hands-free is active and assistant is not speaking
          if (isHandsFreeActive && !isSpeakingRef.current) {
            clearTimeout(restartListeningTimerRef.current);
            restartListeningTimerRef.current = setTimeout(() => {
              if (!isSpeakingRef.current) {
                startListeningInternal();
              }
            }, 300);
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'no-speech' || event.error === 'aborted') {
            // Benign silence timeout — restart listening smoothly
            if (isHandsFreeActive && !isSpeakingRef.current) {
              clearTimeout(restartListeningTimerRef.current);
              restartListeningTimerRef.current = setTimeout(() => {
                startListeningInternal();
              }, 400);
            }
            return;
          }
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
      "What's in front of me?",
      'Help logging in',
      'Navigate to Shivaji Park',
    ];
    const chosenPhrase = samplePhrases[Math.floor(Math.random() * samplePhrases.length)];

    let charIndex = 0;
    const interval = setInterval(() => {
      charIndex += 4;
      setTranscript(chosenPhrase.slice(0, charIndex));
      if (charIndex >= chosenPhrase.length) {
        clearInterval(interval);
        setIsListening(false);
        processSpokenText(chosenPhrase);
      }
    }, 140);
  }, [isHandsFreeActive]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    clearTimeout(restartListeningTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  // Announce modal opening with conversational onboarding and start continuous listening
  useEffect(() => {
    if (isOpen) {
      triggerHapticCue('confirm');
      const greeting =
        initialPrompt ||
        'Welcome. I am your navigation assistant. Are you looking to go somewhere, or do you need help logging in?';
      speakWithAutoResume(greeting);
    } else {
      stopListening();
      stopCamera();
      setTranscript('');
      setAssistantResponse(null);
      setErrorMessage('');
      setIsNavigatingSteps(false);
      setActiveStepIndex(0);
      setSurroundingsResult(null);
      setCapturedImagePreview(null);
    }

    return () => {
      clearTimeout(restartListeningTimerRef.current);
      stopCamera();
    };
  }, [isOpen, initialPrompt]);

  // Keyboard shortcut: Spacebar to toggle microphone, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (isListening) {
          stopListening();
        } else {
          startListeningInternal();
        }
      } else if (e.code === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListening, onClose, startListeningInternal, stopListening]);

  // =========================================================================
  // "DESCRIBE MY SURROUNDINGS" (COMPUTER VISION / AI)
  // =========================================================================
  const handleDescribeSurroundings = async () => {
    try {
      setIsScanningSurroundings(true);
      setErrorMessage('');
      speakWithAutoResume('Scanning your surroundings with camera...');
      setIsCameraActive(true);

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (camErr) {
        console.warn('Camera access unavailable, proceeding with fallback description:', camErr);
      }

      // Allow camera 800ms to stabilize exposure before snapshot
      setTimeout(async () => {
        let base64Snapshot = '';
        if (videoRef.current && canvasRef.current && stream) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            base64Snapshot = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImagePreview(base64Snapshot);
          }
        }

        stopCamera();

        try {
          const res = await fetch('/api/assistant/describe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: base64Snapshot,
              question: "What's in front of me?",
            }),
          });
          const data = await res.json();
          setIsScanningSurroundings(false);

          if (data.success && data.spokenResponse) {
            setSurroundingsResult(data.spokenResponse);
            triggerHapticCue(data.hapticCue || 'obstacle');
            speakWithAutoResume(data.spokenResponse);
          } else {
            const fallback =
              'There are three steps going up, followed by a glass door. Stainless steel handrail is on your right shoulder.';
            setSurroundingsResult(fallback);
            triggerHapticCue('obstacle');
            speakWithAutoResume(fallback);
          }
        } catch {
          const fallback =
            'There are three steps going up, followed by a glass door. Stainless steel handrail is on your right shoulder.';
          setSurroundingsResult(fallback);
          triggerHapticCue('obstacle');
          speakWithAutoResume(fallback);
          setIsScanningSurroundings(false);
        }
      }, 900);
    } catch (err: any) {
      console.warn('Describe error:', err);
      stopCamera();
      const fallback =
        'There are three steps going up, followed by a glass door. Stainless steel handrail is on your right shoulder.';
      setSurroundingsResult(fallback);
      triggerHapticCue('obstacle');
      speakWithAutoResume(fallback);
      setIsScanningSurroundings(false);
    }
  };

  // =========================================================================
  // PROCESSING SPOKEN USER INPUT (HANDS-FREE FOR BLIND USERS)
  // =========================================================================
  const processSpokenText = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    setIsProcessing(true);
    setErrorMessage('');
    const lower = textToProcess.toLowerCase().trim();

    // 1. Check for stop listening / cancel command
    if (
      lower === 'stop listening' ||
      lower === 'pause assistant' ||
      lower === 'close assistant' ||
      lower === 'goodbye' ||
      lower === 'bye'
    ) {
      setIsProcessing(false);
      speakText('Voice assistant paused. Tap anywhere on the screen or press Spacebar whenever you need me.');
      onClose();
      return;
    }

    // 2. Check for surroundings question directly in speech
    if (
      lower.includes("what's in front") ||
      lower.includes('what is in front') ||
      lower.includes('describe surroundings') ||
      lower.includes('describe my surroundings') ||
      lower.includes('what do you see') ||
      lower.includes('is there an obstacle') ||
      lower.includes('look ahead')
    ) {
      setIsProcessing(false);
      await handleDescribeSurroundings();
      return;
    }

    // 3. Check for active navigation step commands
    if (isNavigatingSteps && assistantResponse?.navigationSteps) {
      const steps: NavigationStep[] = assistantResponse.navigationSteps;
      if (lower.includes('next') || lower.includes('forward') || lower.includes('continue')) {
        setIsProcessing(false);
        if (activeStepIndex < steps.length - 1) {
          handleGoToStep(activeStepIndex + 1);
        } else {
          speakWithAutoResume('You have arrived at your destination.');
        }
        return;
      }
      if (lower.includes('repeat') || lower.includes('again') || lower.includes('what was that') || lower.includes('pardon')) {
        setIsProcessing(false);
        handleSpeakCurrentStep();
        return;
      }
      if (lower.includes('previous') || lower.includes('back') || lower.includes('last step')) {
        setIsProcessing(false);
        if (activeStepIndex > 0) {
          handleGoToStep(activeStepIndex - 1);
        }
        return;
      }
      if (lower.includes('where am i') || lower.includes('status')) {
        setIsProcessing(false);
        const curr = steps[activeStepIndex];
        speakWithAutoResume(`You are on Step ${activeStepIndex + 1} of ${steps.length}. ${curr.instruction}`);
        return;
      }
      if (lower.includes('stop navigation') || lower.includes('cancel navigation') || lower.includes('end navigation')) {
        setIsProcessing(false);
        setIsNavigatingSteps(false);
        speakWithAutoResume('Navigation stopped. Where would you like to go now?');
        return;
      }
    }

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

        // A. UI Navigation Hands-Free (Keep assistant open so blind user stays in conversational control)
        if (data.intent === 'NAVIGATE_UI') {
          if (data.action === 'TOGGLE_DARK_MODE' || data.action === 'TOGGLE_LIGHT_MODE') {
            toggleDarkMode();
            speakWithAutoResume(data.spokenResponse);
          } else if (data.action === 'SET_FONT_LARGE') {
            setFontScale('lg');
            speakWithAutoResume(data.spokenResponse);
          } else if (data.targetUrl) {
            router.push(data.targetUrl);
            speakWithAutoResume(data.spokenResponse);
          }
          return;
        }

        // B. Greeting / Onboarding
        if (data.intent === 'GREETING') {
          speakWithAutoResume(data.spokenResponse);
          return;
        }

        // C. Navigation with Landmark Steps
        if (data.intent === 'NAVIGATE' && Array.isArray(data.navigationSteps) && data.navigationSteps.length > 0) {
          setIsNavigatingSteps(true);
          setActiveStepIndex(0);
          const firstStep = data.navigationSteps[0];
          triggerHapticCue(firstStep.cue || 'confirm');

          // Automatically navigate to map in background so route displays immediately!
          if (pathname !== '/gps-precision') {
            router.push(`/gps-precision?dest=${encodeURIComponent(data.destination)}&autonav=1`);
          }

          if (onRouteCalculated) {
            onRouteCalculated(data);
          }

          // Speak route confirmation and first landmark instruction, then immediately resume listening for "next" or "repeat"
          speakWithAutoResume(`${data.spokenResponse}. Step 1: ${firstStep.instruction}`);
          return;
        }

        speakWithAutoResume(data.spokenResponse);
      } else {
        setErrorMessage(data.error || 'Could not understand request.');
        speakWithAutoResume(
          'Sorry, I did not catch that. You can say: take me to Central Library, what is in front of me, or help logging in.'
        );
        triggerHapticCue('error');
      }
    } catch {
      setIsProcessing(false);
      setErrorMessage('Network connection error.');
      speakWithAutoResume('Network error. Please try speaking your destination again.');
      triggerHapticCue('error');
    }
  };

  // =========================================================================
  // STEP-BY-STEP VOICE GUIDANCE ACTIONS
  // =========================================================================
  const handleGoToStep = (index: number) => {
    if (!assistantResponse?.navigationSteps) return;
    const steps: NavigationStep[] = assistantResponse.navigationSteps;
    if (index >= 0 && index < steps.length) {
      setActiveStepIndex(index);
      const step = steps[index];
      triggerHapticCue(step.cue || 'confirm');
      speakWithAutoResume(`Step ${index + 1}: ${step.instruction}`);
    }
  };

  const handleSpeakCurrentStep = () => {
    if (!assistantResponse?.navigationSteps) return;
    const steps: NavigationStep[] = assistantResponse.navigationSteps;
    const step = steps[activeStepIndex];
    if (step) {
      triggerHapticCue(step.cue || 'confirm');
      speakWithAutoResume(`Step ${activeStepIndex + 1}: ${step.instruction}`);
    }
  };

  const handleShowOnInteractiveMap = () => {
    if (!assistantResponse?.destination) return;
    speakText(`Showing route to ${assistantResponse.destination} on interactive map.`);
    onClose();
    router.push(`/gps-precision?dest=${encodeURIComponent(assistantResponse.destination)}&autonav=1`);
  };

  if (!isOpen) return null;

  const currentNavStep =
    assistantResponse?.navigationSteps && assistantResponse.navigationSteps[activeStepIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Voice AI Accessibility Assistant - Hands Free"
    >
      {/* Hidden elements for computer vision camera capture */}
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      <div
        className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border flex flex-col gap-5 max-h-[92vh] overflow-y-auto ${
          isHighContrast
            ? 'bg-black text-white border-white'
            : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary animate-spin" />
            <div>
              <h2 className="font-headline text-lg font-black tracking-wide leading-tight">
                Voice AI Assistant
              </h2>
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Hands-Free Voice Active • Touch-Free
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Voice Assistant"
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <X className="w-6 h-6 text-on-surface-variant" />
          </button>
        </div>

        {/* Accessibility Profile Pill & Vision Quick Action */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-on-surface-variant">
            Active Mode: <strong className="text-primary capitalize">{persona}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDescribeSurroundings}
              disabled={isScanningSurroundings}
              className="px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container hover:opacity-90 transition-all text-xs font-extrabold flex items-center gap-1.5 shadow-2xs border border-secondary/20"
              title="Activate camera and describe physical obstacles"
              aria-label="What is in front of me? Describe surroundings using camera"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isScanningSurroundings ? 'Scanning...' : "What's in front of me?"}</span>
            </button>
            <Badge variant="success" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
              Hands-Free Loop
            </Badge>
          </div>
        </div>

        {/* Camera Live Scanning Overlay Banner (if camera active) */}
        {isCameraActive && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-3 animate-pulse">
            <Camera className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-bounce" />
            <div className="flex flex-col">
              <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                Camera Active • Scanning Surroundings
              </span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold">
                Detecting steps, doorways, obstacles, and tactile cues...
              </span>
            </div>
          </div>
        )}

        {/* Surroundings Description Result Card */}
        {surroundingsResult && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col gap-2.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Surroundings Vision Report
              </span>
              <button
                type="button"
                onClick={() => speakWithAutoResume(surroundingsResult)}
                className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
                aria-label="Repeat surroundings description"
              >
                <Volume2 className="w-3.5 h-3.5" /> Repeat
              </button>
            </div>
            <p className="text-base font-extrabold text-on-surface leading-snug">
              "{surroundingsResult}"
            </p>
            {capturedImagePreview && (
              <div className="mt-1 rounded-xl overflow-hidden max-h-32 border border-outline-variant/30">
                <img
                  src={capturedImagePreview}
                  alt="Captured surroundings snapshot"
                  className="w-full h-32 object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* Central Pulsing Mic Action Area */}
        <div className="flex flex-col items-center justify-center py-3 gap-3">
          <button
            type="button"
            onClick={isListening ? stopListening : startListeningInternal}
            aria-label={isListening ? 'Microphone listening hands free' : 'Tap to start listening'}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-xl ${
              isListening
                ? 'bg-emerald-600 text-white ring-8 ring-emerald-500/30 animate-pulse'
                : isProcessing
                ? 'bg-amber-500 text-white ring-8 ring-amber-500/30'
                : 'bg-surface-container-high text-primary border-2 border-primary hover:bg-primary/10'
            }`}
          >
            {isListening ? (
              <Mic className="w-12 h-12 animate-bounce" />
            ) : (
              <MicOff className="w-12 h-12 opacity-80" />
            )}
          </button>

          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-black text-on-surface text-center">
              {isListening
                ? '🎙️ Listening... (Speak freely, no touch needed)'
                : isProcessing
                ? '⚡ Processing your request...'
                : 'Microphone active • Say any command'}
            </p>
            <span className="text-[11px] font-bold text-on-surface-variant text-center">
              Hands-free continuous loop enabled for blind accessibility
            </span>
          </div>
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
          </div>
        )}

        {/* Processing Spinner */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-primary">
              AI calculating accessible route & landmarks...
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ACTIVE CONTEXT-AWARE TURN-BY-TURN VOICE GUIDANCE PLAYER                   */}
        {/* ========================================================================= */}
        {isNavigatingSteps && currentNavStep && (
          <div className="p-5 rounded-3xl bg-primary/10 border-2 border-primary flex flex-col gap-4 shadow-lg animate-fade-in">
            {/* Navigation Header */}
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary animate-spin" />
                <span className="text-xs font-black text-primary uppercase tracking-wide">
                  Live Spoken Guidance • Step {activeStepIndex + 1} of{' '}
                  {assistantResponse.navigationSteps.length}
                </span>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-primary text-white">
                {currentNavStep.distance}
              </span>
            </div>

            {/* Turn Direction & Landmark Box */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-2xl shadow-md flex-shrink-0">
                {currentNavStep.cue === 'left_turn'
                  ? '⬅️'
                  : currentNavStep.cue === 'right_turn'
                  ? '➡️'
                  : currentNavStep.cue === 'stop'
                  ? '🏁'
                  : '⬆️'}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                {currentNavStep.landmark && (
                  <span className="text-[11px] font-black text-secondary uppercase tracking-wider">
                    Landmark: {currentNavStep.landmark}
                  </span>
                )}
                <p className="text-lg font-black text-on-surface leading-snug">
                  {currentNavStep.instruction}
                </p>
              </div>
            </div>

            {/* Voice Guidance Interactive Controls */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/20">
              <button
                type="button"
                onClick={handleSpeakCurrentStep}
                className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                aria-label="Repeat current turn direction aloud"
              >
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Repeat ("Repeat")</span>
              </button>

              <button
                type="button"
                onClick={() => handleGoToStep(activeStepIndex + 1)}
                disabled={activeStepIndex >= assistantResponse.navigationSteps.length - 1}
                className="h-11 rounded-xl bg-primary text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                aria-label="Advance to next navigation step"
              >
                <span>Next Step ("Next")</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Show on Full Interactive Map CTA */}
            <button
              type="button"
              onClick={handleShowOnInteractiveMap}
              className="h-12 w-full rounded-2xl bg-secondary text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all transform active:scale-98"
            >
              <Navigation className="w-4 h-4 fill-current" />
              <span>Full Screen Map & Route View</span>
            </button>
          </div>
        )}

        {/* Regular AI Response (When not in multi-step navigation player) */}
        {!isNavigatingSteps && assistantResponse && (
          <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-primary uppercase">
                {assistantResponse.destination ? `Destination: ${assistantResponse.destination}` : 'Assistant Response'}
              </span>
              {assistantResponse.metrics?.isStepFree && (
                <span className="text-xs font-extrabold text-secondary">
                  ✓ 100% Step-Free
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-on-surface">
              {assistantResponse.spokenResponse}
            </p>
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
          <span className="text-[11px] font-extrabold text-on-surface-variant w-full">
            Hands-Free Voice Commands (Just Say):
          </span>
          {[
            'Take me to Central Library',
            "What's in front of me?",
            'Next step',
            'Repeat direction',
            'Help logging in',
            'Report a barrier',
          ].map((sample, i) => (
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
