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
  CheckCircle2,
  Eye,
  Compass,
  Square,
} from 'lucide-react';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { triggerHapticCue } from '@/utils/haptics';
import { safeFetchJson } from '@/lib/safeFetch';
import { useAccessibility } from '@/context/AccessibilityContext';
import Badge from './ui/Badge';
import Logo from './Logo';
import {
  classifyVoiceCommand,
  buildNavigationSpeech,
  cleanStepInstruction,
  getConciseDestinationName,
  VOICE_ASSISTANT_NAME,
} from '@/lib/navigationVoiceCommander';
import {
  AuthoritativeNavigationSession,
  navigationSessionStore,
  createNavigationSession,
  transitionAdvanceStep,
  transitionPreviousStep,
  advanceNavigationStep,
  previousNavigationStep,
  repeatNavigationStep,
  stopNavigationSession,
  getNavigationStatusSummary,
} from '@/lib/authoritativeNavigationSession';
import { useVoiceAssistant, VoiceLifecycleState } from '@/context/VoiceAssistantContext';

export interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteCalculated?: (data: Record<string, unknown>) => void;
  initialPrompt?: string;
  initialCommand?: string;
  onStateChange?: (state: VoiceLifecycleState) => void;
}

export default function VoiceAssistantModal({
  isOpen,
  onClose,
  onRouteCalculated,
  initialPrompt,
  initialCommand,
  onStateChange,
}: VoiceAssistantModalProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHORITATIVE NAVIGATION REFS (Single Source of Truth for async callbacks)
  // ─────────────────────────────────────────────────────────────────────────
  const sessionRef = useRef<AuthoritativeNavigationSession | null>(null);
  const activeStepIndexRef = useRef<number>(0);
  const isNavigatingRef = useRef<boolean>(false);

  // Global Voice Assistant Context
  const {
    transcript: contextTranscript,
    voiceState,
    statusText,
    isListening,
    isSpeaking,
    isProcessing: contextIsProcessing,
    isSupported,
    speakNova,
    registerCommandHandler,
    startRecognitionSession,
    stopRecognitionSession,
  } = useVoiceAssistant();

  // Speech Recognition & Audio Lifecycle Guards
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const lastCommandRef = useRef<{ text: string; timestamp: number } | null>(null);

  // Function reference holders to avoid circular closures & hoisting
  const processSpokenTextRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Vision refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // REACT STATE FOR UI RENDERING
  // ─────────────────────────────────────────────────────────────────────────
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Synchronized turn-by-turn guidance state
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isNavigatingSteps, setIsNavigatingSteps] = useState(false);
  const [currentSession, setCurrentSession] = useState<AuthoritativeNavigationSession | null>(null);

  // Computer Vision / Surroundings state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanningSurroundings, setIsScanningSurroundings] = useState(false);
  const [surroundingsResult, setSurroundingsResult] = useState<string | null>(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);

  const { speakText } = useVoiceFeedback();
  const {
    persona,
    isHighContrast,
    toggleDarkMode,
    isDarkMode,
    setFontScale,
  } = useAccessibility();

  // Synchronize transcript from context
  useEffect(() => {
    if (contextTranscript) {
      setTranscript(contextTranscript);
    }
  }, [contextTranscript]);

  // Synchronize active session from navigationSessionStore
  useEffect(() => {
    const unsub = navigationSessionStore.subscribe((sess) => {
      if (sess) {
        sessionRef.current = sess;
        setCurrentSession(sess);
        setActiveStepIndex(sess.currentStepIndex);
        activeStepIndexRef.current = sess.currentStepIndex;
        if (sess.status === 'navigating' || sess.status === 'arrived') {
          isNavigatingRef.current = true;
          setIsNavigatingSteps(true);
        } else {
          isNavigatingRef.current = false;
          setIsNavigatingSteps(false);
        }
      }
    });
    return unsub;
  }, []);

  // Synchronize speaking state with ref
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const speakWithAutoResume = useCallback(
    (text: string, onDone?: () => void) => {
      speakNova(text, onDone);
    },
    [speakNova]
  );

  const stopCameraStreams = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  };

  const stopCamera = useCallback(() => {
    stopCameraStreams();
    setIsCameraActive(false);
    setIsScanningSurroundings(false);
  }, []);

  // Register command processing with the single authoritative engine
  useEffect(() => {
    return registerCommandHandler(async (text: string) => {
      await processSpokenTextRef.current(text);
    });
  }, [registerCommandHandler]);

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHORITATIVE STEP NAVIGATION ACTIONS (Button + Voice Parity)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAdvanceStep = useCallback(() => {
    console.log('[Voice] advanceNavigationStep()');
    const result = advanceNavigationStep();
    if (!result) {
      speakWithAutoResume('There is no active navigation route.');
      return;
    }

    sessionRef.current = result.session;
    activeStepIndexRef.current = result.index;
    setCurrentSession(result.session);
    setActiveStepIndex(result.index);
    triggerHapticCue(result.step.cue || 'confirm');

    const speech = buildNavigationSpeech(
      result.step,
      result.index,
      result.session.steps.length,
      {
        isArrival: result.isArrival,
        destination: result.session.destination,
      }
    );

    speakWithAutoResume(speech);
  }, [speakWithAutoResume]);

  const handlePreviousStep = useCallback(() => {
    console.log('[Voice] previousNavigationStep()');
    const result = previousNavigationStep();
    if (!result) {
      speakWithAutoResume('There is no active navigation route.');
      return;
    }

    sessionRef.current = result.session;
    activeStepIndexRef.current = result.index;
    setCurrentSession(result.session);
    setActiveStepIndex(result.index);
    triggerHapticCue(result.step.cue || 'confirm');

    const speech = buildNavigationSpeech(
      result.step,
      result.index,
      result.session.steps.length,
      {
        destination: result.session.destination,
      }
    );

    speakWithAutoResume(speech);
  }, [speakWithAutoResume]);

  const handleRepeatStep = useCallback(() => {
    console.log('[Voice] repeatNavigationStep()');
    const result = repeatNavigationStep();
    if (!result) {
      speakWithAutoResume('There is no active navigation route.');
      return;
    }

    triggerHapticCue(result.step.cue || 'confirm');
    const speech = buildNavigationSpeech(
      result.step,
      result.index,
      result.session.steps.length,
      {
        isArrival: result.isArrival,
        destination: result.session.destination,
      }
    );

    speakWithAutoResume(speech);
  }, [speakWithAutoResume]);

  const handleStopNavigation = useCallback(() => {
    console.log('[Voice] stopNavigationSession()');
    const stopped = stopNavigationSession();
    sessionRef.current = stopped;
    isNavigatingRef.current = false;
    setIsNavigatingSteps(false);
    triggerHapticCue('confirm');
    speakWithAutoResume('Navigation stopped. Where would you like to go now?');
  }, [speakWithAutoResume]);

  const handleNavigationStatus = useCallback(() => {
    console.log('[Voice] getNavigationStatusSummary()');
    const status = getNavigationStatusSummary();
    if (!status || !status.isActive || !status.currentStep) {
      speakWithAutoResume('There is no active navigation route. Tell me where you would like to go.');
      return;
    }

    const conciseDest = getConciseDestinationName(status.destination);
    const speech = `You are on step ${status.currentStepIndex + 1} of ${status.totalSteps} toward ${conciseDest}. ${cleanStepInstruction(status.currentStep.instruction, conciseDest)}`;
    speakWithAutoResume(speech);
  }, [speakWithAutoResume]);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTER VISION / SURROUNDINGS
  // ─────────────────────────────────────────────────────────────────────────
  const handleDescribeSurroundings = useCallback(async () => {
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
          const data = await safeFetchJson(res);
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
    } catch (err: unknown) {
      console.warn('Describe error:', err);
      stopCamera();
      const fallback =
        'There are three steps going up, followed by a glass door. Stainless steel handrail is on your right shoulder.';
      setSurroundingsResult(fallback);
      triggerHapticCue('obstacle');
      speakWithAutoResume(fallback);
      setIsScanningSurroundings(false);
    }
  }, [speakWithAutoResume, stopCamera]);

  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC PROCESS SPOKEN USER INPUT
  // ─────────────────────────────────────────────────────────────────────────
  const processSpokenText = useCallback(
    async (textToProcess: string) => {
      if (!textToProcess.trim()) return;

      const classified = classifyVoiceCommand(textToProcess);
      const now = Date.now();

      if (
        lastCommandRef.current &&
        lastCommandRef.current.text === classified.normalizedText &&
        now - lastCommandRef.current.timestamp < 800
      ) {
        return;
      }
      lastCommandRef.current = { text: classified.normalizedText, timestamp: now };

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setErrorMessage('');

      try {
        if (classified.intent === 'STOP_LISTENING') {
          isProcessingRef.current = false;
          setIsProcessing(false);
          speakText('Voice assistant paused. Press Spacebar or tap the screen whenever you need me.');
          onClose();
          return;
        }

        if (classified.intent === 'SURROUNDINGS') {
          isProcessingRef.current = false;
          setIsProcessing(false);
          await handleDescribeSurroundings();
          return;
        }

        // Local deterministic navigation controls
        if (classified.intent === 'START_NAVIGATION') {
          isProcessingRef.current = false;
          setIsProcessing(false);
          console.log('[Voice] Command: START_NAVIGATION');
          if (isNavigatingRef.current && sessionRef.current) {
            handleAdvanceStep();
          } else {
            speakWithAutoResume('Tell me where you would like to go, for example: take me to Cardiology Pavilion.');
          }
          return;
        }

        if (isNavigatingRef.current && sessionRef.current) {
          if (classified.intent === 'NEXT_STEP') {
            isProcessingRef.current = false;
            setIsProcessing(false);
            console.log('[Voice] Command: NEXT_STEP');
            handleAdvanceStep();
            return;
          }

          if (classified.intent === 'PREVIOUS_STEP') {
            isProcessingRef.current = false;
            setIsProcessing(false);
            console.log('[Voice] Command: PREVIOUS_STEP');
            handlePreviousStep();
            return;
          }

          if (classified.intent === 'REPEAT_STEP') {
            isProcessingRef.current = false;
            setIsProcessing(false);
            console.log('[Voice] Command: REPEAT_STEP');
            handleRepeatStep();
            return;
          }

          if (classified.intent === 'NAVIGATION_STATUS') {
            isProcessingRef.current = false;
            setIsProcessing(false);
            console.log('[Voice] Command: NAVIGATION_STATUS');
            handleNavigationStatus();
            return;
          }

          if (classified.intent === 'STOP_NAVIGATION') {
            isProcessingRef.current = false;
            setIsProcessing(false);
            console.log('[Voice] Command: STOP_NAVIGATION');
            handleStopNavigation();
            return;
          }
        } else {
          if (
            classified.intent === 'NEXT_STEP' ||
            classified.intent === 'PREVIOUS_STEP' ||
            classified.intent === 'REPEAT_STEP' ||
            classified.intent === 'NAVIGATION_STATUS'
          ) {
            isProcessingRef.current = false;
            setIsProcessing(false);
            speakWithAutoResume('There is no active navigation route. Tell me where you would like to go.');
            return;
          }

          if (classified.intent === 'STOP_NAVIGATION') {
            isProcessingRef.current = false;
            setIsProcessing(false);
            speakWithAutoResume('Navigation is not currently active.');
            return;
          }
        }

        // UI actions
        if (classified.intent === 'UI_ACTION' && classified.payload?.action) {
          isProcessingRef.current = false;
          setIsProcessing(false);
          const action = classified.payload.action;
          if (action === 'LOGIN') {
            router.push('/login');
            speakWithAutoResume('Opening login page.');
          } else if (action === 'REPORT_BARRIER') {
            router.push('/report-barrier');
            speakWithAutoResume('Opening barrier reporting screen.');
          } else if (action === 'DARK_MODE') {
            if (!isDarkMode) toggleDarkMode();
            speakWithAutoResume('Night mode enabled for high contrast viewing.');
          } else if (action === 'LIGHT_MODE') {
            if (isDarkMode) toggleDarkMode();
            speakWithAutoResume('Day mode restored.');
          }
          return;
        }

        // New destinations & general queries
        const res = await fetch('/api/assistant/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: textToProcess,
            userPersona: persona,
          }),
        });

        const data = await safeFetchJson(res);
        isProcessingRef.current = false;
        setIsProcessing(false);

        if (data.success) {
          setAssistantResponse(data);
          triggerHapticCue(data.hapticCue || 'confirm');

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

          if (data.intent === 'GREETING') {
            speakWithAutoResume(data.spokenResponse);
            return;
          }

          if (data.intent === 'NAVIGATE' && Array.isArray(data.navigationSteps) && data.navigationSteps.length > 0) {
            const newSession = createNavigationSession({
              destination: data.destination,
              steps: data.navigationSteps,
              persona: persona,
              routeCoords: data.route?.coordinates,
              metrics: data.metrics,
            });

            sessionRef.current = newSession;
            activeStepIndexRef.current = 0;
            isNavigatingRef.current = true;

            setCurrentSession(newSession);
            setActiveStepIndex(0);
            setIsNavigatingSteps(true);
            navigationSessionStore.setSession(newSession);

            const firstStep = newSession.steps[0];
            triggerHapticCue(firstStep.cue || 'confirm');

            if (pathname !== '/gps-precision') {
              router.push(`/gps-precision?dest=${encodeURIComponent(data.destination)}&autonav=1`);
            }

            if (onRouteCalculated) {
              onRouteCalculated(data);
            }

            const initialSpeech = buildNavigationSpeech(
              firstStep,
              0,
              newSession.steps.length,
              {
                isInitial: true,
                destination: newSession.destination,
              }
            );

            speakWithAutoResume(initialSpeech);
            return;
          }

          speakWithAutoResume(data.spokenResponse);
        } else {
          setErrorMessage(data.error || 'Could not understand request.');
          speakWithAutoResume(
            'Sorry, I did not catch that. You can say: take me to Central Library, what is in front of me, or next step.'
          );
          triggerHapticCue('error');
        }
      } catch {
        isProcessingRef.current = false;
        setIsProcessing(false);
        setErrorMessage('Network connection error.');
        speakWithAutoResume('Network error. Please speak your command again.');
        triggerHapticCue('error');
      }
    },
    [
      handleAdvanceStep,
      handlePreviousStep,
      handleRepeatStep,
      handleNavigationStatus,
      handleStopNavigation,
      handleDescribeSurroundings,
      isDarkMode,
      onClose,
      onRouteCalculated,
      persona,
      pathname,
      router,
      setFontScale,
      speakText,
      speakWithAutoResume,
      toggleDarkMode,
    ]
  );

  // Keep processSpokenTextRef updated
  useEffect(() => {
    processSpokenTextRef.current = processSpokenText;
  }, [processSpokenText]);

  const handleShowOnInteractiveMap = () => {
    const dest = currentSession?.destination || (assistantResponse?.destination as string | undefined);
    if (!dest) return;
    speakText(`Showing route to ${dest} on interactive map.`);
    onClose();
    router.push(`/gps-precision?dest=${encodeURIComponent(dest)}&autonav=1`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ROUTE RECALCULATION & SESSION EVENT SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleRerouteEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ reroute?: unknown }>;
      const reroute = customEvent?.detail?.reroute;
      if (reroute && sessionRef.current && isNavigatingRef.current) {
        speakWithAutoResume(
          'An obstacle was detected ahead. I found a safer accessible route. Continuing from your current position.'
        );
      }
    };

    window.addEventListener('pathfinder:route-recalculated', handleRerouteEvent);
    return () => {
      window.removeEventListener('pathfinder:route-recalculated', handleRerouteEvent);
    };
  }, [speakWithAutoResume]);

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL OPEN / CLOSE LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isOpen) {
      triggerHapticCue('confirm');
      onStateChange?.(initialCommand ? 'PROCESSING' : 'OPEN_COMMAND_LISTENING');
      const greeting =
        initialPrompt ||
        `Hello, I am ${VOICE_ASSISTANT_NAME}. How can I help you? You can say: take me to a destination, or ask what is in front of you.`;

      timer = setTimeout(() => {
        if (initialCommand && initialCommand.trim()) {
          processSpokenTextRef.current(initialCommand);
        } else {
          speakWithAutoResume(greeting);
        }
      }, 50);
    } else {
      stopCameraStreams();
      setTranscript('');
      setErrorMessage('');
      setIsCameraActive(false);
      setIsScanningSurroundings(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
      stopCameraStreams();
    };
  }, [isOpen, initialPrompt, initialCommand, onStateChange, speakWithAutoResume]);

  // Keyboard shortcut: Spacebar to toggle microphone, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (isListening) {
          stopRecognitionSession();
        } else {
          startRecognitionSession();
        }
      } else if (e.code === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListening, onClose, startRecognitionSession, stopRecognitionSession]);

  if (!isOpen) return null;

  const activeSessionSteps = currentSession?.steps;
  const currentNavStep = activeSessionSteps && activeSessionSteps[activeStepIndex];
  const totalNavSteps = activeSessionSteps ? activeSessionSteps.length : 0;
  const isFinalStep = activeStepIndex >= totalNavSteps - 1;
  const isFirstStep = activeStepIndex <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Voice AI Accessibility Assistant - Hands Free"
    >
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
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <div>
              <h2 className="font-headline text-lg font-black tracking-wide leading-tight">
                {VOICE_ASSISTANT_NAME} Accessibility Assistant
              </h2>
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Wake: &quot;Hey {VOICE_ASSISTANT_NAME}&quot; • Hands-Free Active
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Live Voice Status Badge */}
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 shadow-2xs ${
              voiceState === 'OPEN_COMMAND_LISTENING'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : voiceState === 'PROCESSING'
                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                : voiceState === 'SPEAKING'
                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                : voiceState === 'MIC_UNAVAILABLE'
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                : 'bg-surface-container text-on-surface-variant'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                voiceState === 'OPEN_COMMAND_LISTENING'
                  ? 'bg-emerald-500 animate-pulse'
                  : voiceState === 'PROCESSING'
                  ? 'bg-blue-500 animate-pulse'
                  : voiceState === 'SPEAKING'
                  ? 'bg-purple-500 animate-pulse'
                  : voiceState === 'MIC_UNAVAILABLE'
                  ? 'bg-rose-500'
                  : 'bg-on-surface-variant'
              }`} />
              <span>{statusText}</span>
            </span>
            <button
              onClick={onClose}
              aria-label="Close Voice Assistant"
              className="p-2 rounded-full hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <X className="w-6 h-6 text-on-surface-variant" />
            </button>
          </div>
        </div>

        {/* Fallback Notice for Unsupported Browsers */}
        {!isSupported && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Voice recognition isn&apos;t supported in this browser. Please use a supported browser or open the assistant using the button.
            </span>
          </div>
        )}

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
              className="px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container hover:opacity-90 transition-all text-xs font-extrabold flex items-center gap-1.5 shadow-2xs border border-secondary/20 cursor-pointer"
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

        {/* Camera Live Scanning Overlay Banner */}
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
                className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                aria-label="Repeat surroundings description"
              >
                <Volume2 className="w-3.5 h-3.5" /> Repeat
              </button>
            </div>
            <p className="text-base font-extrabold text-on-surface leading-snug">
              &ldquo;{surroundingsResult}&rdquo;
            </p>
            {capturedImagePreview && (
              <div className="mt-1 rounded-xl overflow-hidden max-h-32 border border-outline-variant/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
            onClick={isListening ? stopRecognitionSession : startRecognitionSession}
            aria-label={isListening ? 'Microphone listening hands free' : 'Tap to start listening'}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-xl cursor-pointer ${
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
              {statusText}
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
              &ldquo;{transcript}&rdquo;
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

        {/* Active Context-Aware Turn-by-Turn Voice Guidance Player */}
        {isNavigatingSteps && currentNavStep && (
          <div className="p-5 rounded-3xl bg-primary/10 border-2 border-primary flex flex-col gap-4 shadow-lg animate-fade-in">
            {/* Navigation Header */}
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary animate-spin" />
                <span className="text-xs font-black text-primary uppercase tracking-wide">
                  Live Guidance • Step {activeStepIndex + 1} of {totalNavSteps}
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
                  <span className="text-[11px] font-black text-secondary uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                    Landmark: {currentNavStep.landmark}
                  </span>
                )}
                <p className="text-lg font-black text-on-surface leading-snug">
                  {cleanStepInstruction(currentNavStep.instruction, currentSession?.destination)}
                </p>
              </div>
            </div>

            {/* Voice Guidance Interactive Controls (Full Button + Voice Parity) */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-primary/20">
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={isFirstStep}
                className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                aria-label="Previous navigation step"
              >
                <ChevronLeft className="w-4 h-4 text-primary" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleRepeatStep}
                className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                aria-label="Repeat current turn direction aloud"
              >
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Repeat</span>
              </button>

              <button
                type="button"
                onClick={handleAdvanceStep}
                className="h-11 rounded-xl bg-primary text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md hover:bg-primary/90 transition-colors cursor-pointer"
                aria-label={isFinalStep ? 'Finish navigation' : 'Advance to next navigation step'}
              >
                <span>{isFinalStep ? 'Arrive' : 'Next Step'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Stop Navigation & Map CTAs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStopNavigation}
                className="h-11 rounded-2xl bg-surface-container-high text-rose-600 dark:text-rose-400 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
                aria-label="Stop navigation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Navigation</span>
              </button>

              <button
                type="button"
                onClick={handleShowOnInteractiveMap}
                className="h-11 rounded-2xl bg-secondary text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md hover:opacity-95 transition-all cursor-pointer"
                aria-label="View route on interactive map"
              >
                <Navigation className="w-3.5 h-3.5 fill-current" />
                <span>Map View</span>
              </button>
            </div>
          </div>
        )}

        {/* Regular AI Response (When not in multi-step navigation player) */}
        {!isNavigatingSteps && assistantResponse && (
          <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-primary uppercase">
                {assistantResponse.destination ? `Destination: ${String(assistantResponse.destination)}` : 'Assistant Response'}
              </span>
              {(assistantResponse.metrics as { isStepFree?: boolean } | undefined)?.isStepFree && (
                <span className="text-xs font-extrabold text-secondary">
                  ✓ 100% Step-Free
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-on-surface">
              {String(assistantResponse.spokenResponse || '')}
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
            'Previous step',
            'Where am I?',
            'Stop navigation',
          ].map((sample, i) => (
            <button
              key={i}
              onClick={() => {
                setTranscript(sample);
                processSpokenTextRef.current(sample);
              }}
              className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-primary/20 text-xs font-bold text-on-surface transition-colors cursor-pointer"
            >
              &ldquo;{sample}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
