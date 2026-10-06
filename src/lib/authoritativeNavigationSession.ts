/**
 * authoritativeNavigationSession.ts
 *
 * Single Source of Truth (SSOT) for active navigation sessions in PixelMuse.
 *
 * Guarantees:
 * - Deterministic navigation transitions (advance, previous, repeat, stop, reroute).
 * - Boundary enforcement (currentStepIndex never < 0 or > steps.length - 1).
 * - Exact arrival detection on the final step.
 * - In-memory pub/sub and window event dispatch for 100% UI / voice parity.
 * - Thread-safe & synchronous transition operations.
 */

import { NavigationStep } from './navigationVoiceCommander';

export type NavigationStatus =
  | 'idle'
  | 'preparing'
  | 'navigating'
  | 'rerouting'
  | 'arrived'
  | 'stopped';

export interface AuthoritativeNavigationSession {
  sessionId: string;
  destination: string;
  destinationAddress?: string;
  steps: NavigationStep[];
  currentStepIndex: number;
  status: NavigationStatus;
  startedAt: number;
  lastCommand?: string;
  lastSpokenStepIndex?: number;
  lastProcessedCommandId?: string;
  persona?: string;
  routeCoords?: Array<{ lat: number; lng: number }>;
  metrics?: {
    distanceMeters?: number;
    estimatedTimeMinutes?: number;
    isStepFree?: boolean;
    barriersAvoided?: number;
  };
}

export interface StepTransitionResult {
  session: AuthoritativeNavigationSession;
  step: NavigationStep;
  index: number;
  isArrival: boolean;
  speechText: string;
}

/**
 * Creates a brand new authoritative navigation session.
 */
export function createNavigationSession(input: {
  destination: string;
  steps: NavigationStep[];
  destinationAddress?: string;
  persona?: string;
  routeCoords?: Array<{ lat: number; lng: number }>;
  metrics?: Record<string, unknown>;
}): AuthoritativeNavigationSession {
  const sessionId = `nav-session-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const now = Date.now();

  const session: AuthoritativeNavigationSession = {
    sessionId,
    destination: input.destination,
    destinationAddress: input.destinationAddress,
    steps: input.steps.length > 0 ? input.steps : [
      {
        stepNumber: 1,
        instruction: 'Follow the designated accessible path to your destination.',
        cue: 'confirm',
        distance: 'Direct',
      },
    ],
    currentStepIndex: 0,
    status: 'navigating',
    startedAt: now,
    lastSpokenStepIndex: 0,
    persona: input.persona || 'low-vision',
    routeCoords: input.routeCoords,
    metrics: input.metrics,
  };

  return session;
}

/**
 * Deterministically advances the navigation session to the next step.
 * If already on the final step, transitions session status to 'arrived' and prevents out-of-bounds increments.
 */
export function transitionAdvanceStep(
  session: AuthoritativeNavigationSession
): StepTransitionResult {
  const total = session.steps.length;
  const currentIdx = session.currentStepIndex;

  // Final step reached -> mark arrived
  if (currentIdx >= total - 1) {
    const updated: AuthoritativeNavigationSession = {
      ...session,
      status: 'arrived',
      lastCommand: 'NEXT_STEP',
    };
    const finalStep = session.steps[total - 1];
    return {
      session: updated,
      step: finalStep,
      index: total - 1,
      isArrival: true,
      speechText: `You have arrived at ${session.destination}.`,
    };
  }

  // Regular step advance
  const nextIdx = currentIdx + 1;
  const nextStep = session.steps[nextIdx];

  const updated: AuthoritativeNavigationSession = {
    ...session,
    currentStepIndex: nextIdx,
    lastSpokenStepIndex: nextIdx,
    lastCommand: 'NEXT_STEP',
  };

  return {
    session: updated,
    step: nextStep,
    index: nextIdx,
    isArrival: false,
    speechText: nextStep.instruction,
  };
}

/**
 * Deterministically steps back to the previous navigation step.
 * Prevents decrementing below 0.
 */
export function transitionPreviousStep(
  session: AuthoritativeNavigationSession
): StepTransitionResult {
  const currentIdx = session.currentStepIndex;
  const prevIdx = Math.max(0, currentIdx - 1);
  const prevStep = session.steps[prevIdx];

  const updated: AuthoritativeNavigationSession = {
    ...session,
    currentStepIndex: prevIdx,
    lastSpokenStepIndex: prevIdx,
    status: 'navigating', // Reset arrived if user steps back
    lastCommand: 'PREVIOUS_STEP',
  };

  return {
    session: updated,
    step: prevStep,
    index: prevIdx,
    isArrival: false,
    speechText: prevStep.instruction,
  };
}

/**
 * Repeats the current navigation step.
 */
export function transitionRepeatStep(
  session: AuthoritativeNavigationSession
): StepTransitionResult {
  const currentIdx = Math.min(session.steps.length - 1, Math.max(0, session.currentStepIndex));
  const step = session.steps[currentIdx];

  const updated: AuthoritativeNavigationSession = {
    ...session,
    lastCommand: 'REPEAT_STEP',
  };

  return {
    session: updated,
    step,
    index: currentIdx,
    isArrival: session.status === 'arrived',
    speechText: step.instruction,
  };
}

/**
 * Stops/cancels the active navigation session.
 */
export function transitionStopNavigation(
  session: AuthoritativeNavigationSession
): AuthoritativeNavigationSession {
  return {
    ...session,
    status: 'stopped',
    lastCommand: 'STOP_NAVIGATION',
  };
}

/**
 * Recalculates the navigation session with new steps while preserving
 * destination, persona, and user session continuity.
 */
export function transitionRecalculateSession(
  session: AuthoritativeNavigationSession,
  newSteps: NavigationStep[]
): AuthoritativeNavigationSession {
  return {
    ...session,
    steps: newSteps.length > 0 ? newSteps : session.steps,
    currentStepIndex: 0,
    lastSpokenStepIndex: 0,
    status: 'rerouting',
    lastCommand: 'ROUTE_RECALCULATED',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON ACTIVE SESSION STORE & PUB/SUB
// ─────────────────────────────────────────────────────────────────────────────

type SessionListener = (session: AuthoritativeNavigationSession | null) => void;

class AuthoritativeSessionStore {
  private currentSession: AuthoritativeNavigationSession | null = null;
  private listeners: Set<SessionListener> = new Set();

  public getSession(): AuthoritativeNavigationSession | null {
    return this.currentSession;
  }

  public setSession(session: AuthoritativeNavigationSession | null): void {
    this.currentSession = session;
    this.notify();
  }

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentSession);
      } catch (err) {
        console.warn('Session store listener error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const event = new CustomEvent('pathfinder:authoritative-navigation-updated', {
          detail: { session: this.currentSession },
        });
        window.dispatchEvent(event);
      } catch {
        // ignore
      }
    }
  }
}

export const navigationSessionStore = new AuthoritativeSessionStore();

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE DISPATCH FUNCTIONS (Button + Voice SSOT Parity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single authoritative function to advance to the next step.
 * Called identically by UI "Next" button and Voice "Next step".
 */
export function advanceNavigationStep(): StepTransitionResult | null {
  const current = navigationSessionStore.getSession();
  if (!current || current.status === 'stopped' || current.status === 'idle') {
    return null;
  }
  const result = transitionAdvanceStep(current);
  navigationSessionStore.setSession(result.session);
  return result;
}

/**
 * Single authoritative function to move back to the previous step.
 */
export function previousNavigationStep(): StepTransitionResult | null {
  const current = navigationSessionStore.getSession();
  if (!current || current.status === 'stopped' || current.status === 'idle') {
    return null;
  }
  const result = transitionPreviousStep(current);
  navigationSessionStore.setSession(result.session);
  return result;
}

/**
 * Single authoritative function to repeat the current step.
 */
export function repeatNavigationStep(): StepTransitionResult | null {
  const current = navigationSessionStore.getSession();
  if (!current || current.status === 'stopped' || current.status === 'idle') {
    return null;
  }
  const result = transitionRepeatStep(current);
  navigationSessionStore.setSession(result.session);
  return result;
}

/**
 * Single authoritative function to stop/cancel navigation.
 */
export function stopNavigationSession(): AuthoritativeNavigationSession | null {
  const current = navigationSessionStore.getSession();
  if (!current) return null;
  const updated = transitionStopNavigation(current);
  navigationSessionStore.setSession(updated);
  return updated;
}

/**
 * Retrieves the current status summary of the active session.
 */
export function getNavigationStatusSummary(): {
  isActive: boolean;
  destination: string;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: NavigationStep | null;
  status: NavigationStatus;
} | null {
  const current = navigationSessionStore.getSession();
  if (!current || current.status === 'stopped' || current.status === 'idle') {
    return null;
  }
  const idx = Math.min(current.steps.length - 1, Math.max(0, current.currentStepIndex));
  return {
    isActive: current.status === 'navigating' || current.status === 'arrived',
    destination: current.destination,
    currentStepIndex: idx,
    totalSteps: current.steps.length,
    currentStep: current.steps[idx] || null,
    status: current.status,
  };
}
