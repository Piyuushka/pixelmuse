'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  VOICE_ASSISTANT_NAME,
  detectWakeWord,
} from '@/lib/navigationVoiceCommander';
import VoiceAssistantModal from '@/components/VoiceAssistantModal';

/**
 * Authoritative Voice Assistant Lifecycle State Machine:
 *
 * CLOSED_WAKE_LISTENING
 *         ↓
 *   WAKE_DETECTED
 *         ↓
 * OPEN_COMMAND_LISTENING
 *         ↓
 *    PROCESSING
 *         ↓
 *     SPEAKING
 *         ↓
 * OPEN_COMMAND_LISTENING (or CLOSED_WAKE_LISTENING if closed)
 */
export type VoiceLifecycleState =
  | 'CLOSED_WAKE_LISTENING' // Modal closed; listening for "Hey Nova"
  | 'WAKE_DETECTED'         // Wake word recognized; transitioning
  | 'OPEN_COMMAND_LISTENING'// Modal open; listening for commands without wake word
  | 'PROCESSING'            // Executing navigation command or API query
  | 'SPEAKING'              // Nova is speaking via TTS; recognition paused
  | 'MIC_UNAVAILABLE'       // Microphone permission denied or no mic
  | 'UNSUPPORTED';          // Web Speech API not supported in browser

// Backward compatibility alias for components expecting previous type
export type VoiceAssistantLifecycleState =
  | VoiceLifecycleState
  | 'IDLE'
  | 'LISTENING'
  | 'ACTIVE_NAVIGATION';

export interface VoiceAssistantContextType {
  isOpen: boolean;
  voiceState: VoiceLifecycleState;
  assistantState: VoiceLifecycleState; // Alias for backward compatibility
  statusText: string;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  transcript: string;
  wakeWordName: string;
  openAssistant: (initialPrompt?: string, initialCommand?: string) => void;
  closeAssistant: () => void;
  setVoiceState: (state: VoiceLifecycleState) => void;
  setAssistantState: (state: VoiceLifecycleState) => void; // Alias
  setIsSpeakingState: (isSpeaking: boolean) => void;
  speakNova: (text: string, onDone?: () => void) => void;
  registerCommandHandler: (handler: (text: string) => Promise<void>) => () => void;
  startRecognitionSession: () => void;
  stopRecognitionSession: () => void;
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType | undefined>(undefined);

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: Array<Array<{ transcript: string }> & { isFinal?: boolean }>;
  }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceStateInternal] = useState<VoiceLifecycleState>('CLOSED_WAKE_LISTENING');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);
  const [initialCommand, setInitialCommand] = useState<string | undefined>(undefined);

  // Authoritative State Refs to prevent closure stale states
  const isOpenRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isRecognitionRunningRef = useRef(false);
  const modeRef = useRef<'WAKE' | 'COMMAND'>('WAKE');
  const shouldBeListeningRef = useRef(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedFinalRef = useRef<{ text: string; time: number } | null>(null);
  const commandHandlerRef = useRef<((text: string) => Promise<void>) | null>(null);
  const startRecognitionSessionRef = useRef<() => void>(() => {});

  useEffect(() => {
    isOpenRef.current = isOpen;
    modeRef.current = isOpen ? 'COMMAND' : 'WAKE';
  }, [isOpen]);

  const setVoiceState = useCallback((state: VoiceLifecycleState) => {
    setVoiceStateInternal(state);
  }, []);

  // Compute user-facing status string
  const getStatusText = (state: VoiceLifecycleState): string => {
    switch (state) {
      case 'CLOSED_WAKE_LISTENING':
        return `Listening for "Hey ${VOICE_ASSISTANT_NAME}"...`;
      case 'WAKE_DETECTED':
        return `${VOICE_ASSISTANT_NAME} activated...`;
      case 'OPEN_COMMAND_LISTENING':
        return 'Listening...';
      case 'PROCESSING':
        return 'Thinking...';
      case 'SPEAKING':
        return 'Speaking...';
      case 'MIC_UNAVAILABLE':
        return 'Microphone unavailable';
      case 'UNSUPPORTED':
        return 'Voice recognition not supported';
      default:
        return 'Ready';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RECOGNITION STOP & SAFE CLEANUP
  // ─────────────────────────────────────────────────────────────────────────────
  const stopRecognitionSession = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Safe ignore
      }
    }
    isRecognitionRunningRef.current = false;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHORITATIVE SINGLE SPEECH RECOGNITION INSTANCE
  // ─────────────────────────────────────────────────────────────────────────────
  const startRecognitionSession = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Check browser support
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setVoiceStateInternal('UNSUPPORTED');
      console.warn('[Voice] SpeechRecognition not supported in this browser.');
      return;
    }

    // Mutex guard: Don't start if already running or if actively speaking TTS
    if (isRecognitionRunningRef.current) {
      return;
    }
    if (isSpeakingRef.current) {
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onspeechstart = null;
          recognitionRef.current.onspeechend = null;
          recognitionRef.current.stop();
        } catch {
          // Safe ignore
        }
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecognitionRunningRef.current = true;
        const currentMode = isOpenRef.current ? 'COMMAND' : 'WAKE';
        modeRef.current = currentMode;
        console.log(`[Voice] Mode: ${currentMode === 'WAKE' ? 'CLOSED_WAKE_LISTENING' : 'OPEN_COMMAND_LISTENING'}`);
        console.log('[Voice] Recognition started');
        console.log('[Voice] Audio started');
        setVoiceStateInternal(currentMode === 'WAKE' ? 'CLOSED_WAKE_LISTENING' : 'OPEN_COMMAND_LISTENING');
      };

      recognition.onspeechstart = () => {
        // User speech detected
      };

      recognition.onspeechend = () => {
        // User speech ended
      };

      recognition.onresult = (event) => {
        if (isSpeakingRef.current) return;

        let finalPart = '';
        let interimPart = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalPart += res[0]?.transcript || '';
          } else {
            interimPart += res[0]?.transcript || '';
          }
        }

        const trimmedInterim = interimPart.trim();
        const trimmedFinal = finalPart.trim();

        // ── STATE A: CLOSED_WAKE_LISTENING ──
        if (!isOpenRef.current) {
          const candidateText = trimmedFinal || trimmedInterim;
          if (!candidateText) return;

          console.log(`[Voice] Mode: CLOSED_WAKE_LISTENING`);
          console.log(`[Voice] Transcript: "${candidateText}"`);

          const wake = detectWakeWord(candidateText, VOICE_ASSISTANT_NAME);
          if (wake.detected) {
            console.log('[Voice] Wake word detected');
            console.log('[Voice] Switching to COMMAND_LISTENING');
            console.log('[Voice] Assistant opened');

            setVoiceStateInternal('WAKE_DETECTED');
            modeRef.current = 'COMMAND';

            // Open assistant and forward any extracted trailing command
            setInitialPrompt(undefined);
            setInitialCommand(wake.extractedCommand);
            setIsOpen(true);
            setTranscript(candidateText);

            if (wake.extractedCommand) {
              setVoiceStateInternal('PROCESSING');
            } else {
              setVoiceStateInternal('OPEN_COMMAND_LISTENING');
            }
          } else {
            console.log(`[Voice] Non-wake transcript ignored in wake mode: "${candidateText}"`);
          }
          return;
        }

        // ── STATE B: OPEN_COMMAND_LISTENING ──
        // Wake word is NOT required!
        if (trimmedInterim) {
          setTranscript(trimmedInterim);
        }

        if (trimmedFinal) {
          console.log(`[Voice] Mode: OPEN_COMMAND_LISTENING`);
          console.log(`[Voice] Transcript: "${trimmedFinal}"`);
          setTranscript(trimmedFinal);

          // Duplicate event debounce (same transcript within 800ms)
          const now = Date.now();
          if (
            lastProcessedFinalRef.current &&
            lastProcessedFinalRef.current.text === trimmedFinal.toLowerCase() &&
            now - lastProcessedFinalRef.current.time < 800
          ) {
            return;
          }
          lastProcessedFinalRef.current = { text: trimmedFinal.toLowerCase(), time: now };

          // Execute recognized command
          if (commandHandlerRef.current) {
            setVoiceStateInternal('PROCESSING');
            commandHandlerRef.current(trimmedFinal).finally(() => {
              if (!isSpeakingRef.current && isOpenRef.current) {
                setVoiceStateInternal('OPEN_COMMAND_LISTENING');
              }
            });
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn(`[Voice] Recognition error: ${event.error}`);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isRecognitionRunningRef.current = false;
          setVoiceStateInternal('MIC_UNAVAILABLE');
          console.warn('[Voice] Microphone permission denied or service not allowed');
          return;
        }

        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Normal silence timeout or manual stop; onend will handle clean restart
          return;
        }

        // Network or other transient error
        isRecognitionRunningRef.current = false;
      };

      recognition.onend = () => {
        isRecognitionRunningRef.current = false;
        console.log('[Voice] Recognition ended');

        // Deterministic auto-restart if intended to be active and not speaking
        if (shouldBeListeningRef.current && !isSpeakingRef.current && voiceState !== 'MIC_UNAVAILABLE') {
          if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
          }
          restartTimerRef.current = setTimeout(() => {
            if (shouldBeListeningRef.current && !isSpeakingRef.current && !isRecognitionRunningRef.current) {
              console.log('[Voice] Auto-restarting recognition...');
              startRecognitionSessionRef.current();
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('[Voice] Recognition start exception:', err);
      isRecognitionRunningRef.current = false;
    }
  }, [voiceState]);

  useEffect(() => {
    startRecognitionSessionRef.current = startRecognitionSession;
  }, [startRecognitionSession]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEXT-TO-SPEECH (TTS) SYNCHRONIZATION & MUTEX
  // ─────────────────────────────────────────────────────────────────────────────
  const speakNova = useCallback(
    (text: string, onDone?: () => void) => {
      if (!text || typeof window === 'undefined') {
        if (onDone) onDone();
        return;
      }

      isSpeakingRef.current = true;
      setVoiceStateInternal('SPEAKING');
      console.log('[Voice] TTS started');

      // Stop microphone recognition while Nova speaks to prevent acoustic loopback
      stopRecognitionSession();

      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;

          const finishSpeech = () => {
            console.log('[Voice] TTS ended');
            if (onDone) onDone();

            // 350ms acoustic buffer before resuming microphone
            if (restartTimerRef.current) {
              clearTimeout(restartTimerRef.current);
            }
            restartTimerRef.current = setTimeout(() => {
              isSpeakingRef.current = false;
              if (isOpenRef.current) {
                setVoiceStateInternal('OPEN_COMMAND_LISTENING');
              } else {
                setVoiceStateInternal('CLOSED_WAKE_LISTENING');
              }
              console.log('[Voice] Recognition restarted');
              startRecognitionSessionRef.current();
            }, 350);
          };

          utterance.onend = finishSpeech;
          utterance.onerror = finishSpeech;

          window.speechSynthesis.speak(utterance);
          return;
        } catch (e) {
          console.warn('[Voice] SpeechSynthesis error:', e);
        }
      }

      // Fallback if speechSynthesis throws or missing
      isSpeakingRef.current = false;
      if (onDone) onDone();
      startRecognitionSessionRef.current();
    },
    [stopRecognitionSession]
  );

  const setIsSpeakingState = useCallback((isSpeaking: boolean) => {
    isSpeakingRef.current = isSpeaking;
    if (isSpeaking) {
      setVoiceStateInternal('SPEAKING');
      stopRecognitionSession();
    }
  }, [stopRecognitionSession]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ASSISTANT MODAL OPEN / CLOSE CONTROLLERS
  // ─────────────────────────────────────────────────────────────────────────────
  const openAssistant = useCallback(
    (prompt?: string, command?: string) => {
      console.log('[Voice] Assistant opened manually or via wake word');
      console.log('[Voice] Switching to COMMAND_LISTENING');
      modeRef.current = 'COMMAND';
      setInitialPrompt(prompt);
      setInitialCommand(command);
      setIsOpen(true);
      setVoiceStateInternal(command ? 'PROCESSING' : 'OPEN_COMMAND_LISTENING');

      // Ensure recognition is running in command mode
      if (!isRecognitionRunningRef.current && !isSpeakingRef.current) {
        startRecognitionSessionRef.current();
      }
    },
    []
  );

  const closeAssistant = useCallback(() => {
    console.log('[Voice] Assistant closed');
    console.log('[Voice] Mode: CLOSED_WAKE_LISTENING');
    setIsOpen(false);
    setInitialPrompt(undefined);
    setInitialCommand(undefined);
    setTranscript('');
    modeRef.current = 'WAKE';
    setVoiceStateInternal('CLOSED_WAKE_LISTENING');

    // Smoothly restart in wake-listening mode
    stopRecognitionSession();
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }
    restartTimerRef.current = setTimeout(() => {
      startRecognitionSessionRef.current();
    }, 200);
  }, [stopRecognitionSession]);

  const registerCommandHandler = useCallback(
    (handler: (text: string) => Promise<void>) => {
      commandHandlerRef.current = handler;
      return () => {
        if (commandHandlerRef.current === handler) {
          commandHandlerRef.current = null;
        }
      };
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIAL LIFECYCLE MOUNT & PERMISSION INITIALIZER
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    shouldBeListeningRef.current = true;
    startRecognitionSessionRef.current();

    // Browser gesture unlock: If mic is pending user permission, unlock on first user click/touch
    const handleFirstInteraction = () => {
      if (!isRecognitionRunningRef.current && !isSpeakingRef.current && voiceState !== 'UNSUPPORTED') {
        startRecognitionSessionRef.current();
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      shouldBeListeningRef.current = false;
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      stopRecognitionSession();
    };
  }, [stopRecognitionSession, voiceState]);

  // Global event listener for custom open requests
  useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt?: string; command?: string }>;
      openAssistant(customEvent?.detail?.prompt, customEvent?.detail?.command);
    };

    window.addEventListener('pathfinder:open-voice-assistant', handleOpenEvent);
    return () => {
      window.removeEventListener('pathfinder:open-voice-assistant', handleOpenEvent);
    };
  }, [openAssistant]);

  return (
    <VoiceAssistantContext.Provider
      value={{
        isOpen,
        voiceState,
        assistantState: voiceState,
        statusText: getStatusText(voiceState),
        isListening: voiceState === 'OPEN_COMMAND_LISTENING' || voiceState === 'CLOSED_WAKE_LISTENING',
        isSpeaking: voiceState === 'SPEAKING',
        isProcessing: voiceState === 'PROCESSING' || voiceState === 'WAKE_DETECTED',
        isSupported,
        transcript,
        wakeWordName: VOICE_ASSISTANT_NAME,
        openAssistant,
        closeAssistant,
        setVoiceState,
        setAssistantState: setVoiceState,
        setIsSpeakingState,
        speakNova,
        registerCommandHandler,
        startRecognitionSession,
        stopRecognitionSession,
      }}
    >
      {children}
      {/* Exactly ONE global VoiceAssistantModal in the DOM */}
      <VoiceAssistantModal
        isOpen={isOpen}
        onClose={closeAssistant}
        initialPrompt={initialPrompt}
        initialCommand={initialCommand}
        onStateChange={setVoiceState}
      />
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const context = useContext(VoiceAssistantContext);
  if (!context) {
    throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
  }
  return context;
}
