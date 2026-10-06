/**
 * PathFinder Access — Guardian Telemetry Broadcaster
 *
 * Dedicated in-memory pub/sub broadcaster for guardian monitoring events.
 * Separate from `barrierBroadcaster` (which handles routing/obstacle events)
 * to keep the two event domains isolated.
 *
 * Architecture:
 *  - Dependents emit events via `guardianBroadcaster.emitToGuardians(dependentEmail, event)`
 *  - Only guardians with an ACCEPTED GuardianLink for that dependent receive the event
 *  - Guardians subscribe via `/api/guardian/stream` (SSE) which calls `subscribeForGuardian()`
 */

import { getActiveLinksForGuardian } from './db/userStore';
import type { AnomalyType, DeviationResult, ProlongedStopResult } from './guardianAnomalyEngine';

// ─── EVENT TYPES ──────────────────────────────────────────────────────────────

export type GuardianEventType =
  | 'LOCATION_UPDATE'
  | 'ROUTE_DEVIATION'
  | 'PROLONGED_STOP'
  | 'SOS_TRIGGER'
  | 'TRIP_STARTED'
  | 'TRIP_ENDED'
  | 'CONNECTED';

export interface GuardianLocationPayload {
  coords: { lat: number; lng: number };
  tripId: string;
  origin: string;
  destination: string;
  tripStatus: string;
  startTime: string;
  lastPingAt: string;
  routeGeometry?: Array<{ lat: number; lng: number }>;
}

export interface GuardianDeviationPayload extends GuardianLocationPayload {
  distanceMeters: number;
  nearestRoutePoint: { lat: number; lng: number } | null;
}

export interface GuardianStopPayload extends GuardianLocationPayload {
  stopDurationMs: number;
  staticSince: string | null;
}

export interface GuardianSosPayload {
  coords: { lat: number; lng: number };
  triggeredAt: string;
  tripId?: string;
  destination?: string;
}

export interface GuardianEvent {
  id: string;
  type: GuardianEventType;
  dependentEmail: string;
  dependentName: string;
  timestamp: string;
  payload:
    | GuardianLocationPayload
    | GuardianDeviationPayload
    | GuardianStopPayload
    | GuardianSosPayload
    | Record<string, unknown>;
  message: string;
}

export type GuardianEventCallback = (event: GuardianEvent) => void;

// ─── BROADCASTER CLASS ────────────────────────────────────────────────────────

class GuardianBroadcasterClass {
  /**
   * Map of guardianEmail → Set<callback>.
   * Each connected SSE client for a guardian registers exactly one callback.
   */
  private guardianSubscribers: Map<string, Set<GuardianEventCallback>> = new Map();

  /**
   * Subscribe a guardian to receive telemetry events.
   * Returns an unsubscribe function (call on SSE disconnect).
   */
  public subscribeForGuardian(
    guardianEmail: string,
    callback: GuardianEventCallback
  ): () => void {
    const key = guardianEmail.toLowerCase();
    if (!this.guardianSubscribers.has(key)) {
      this.guardianSubscribers.set(key, new Set());
    }
    this.guardianSubscribers.get(key)!.add(callback);

    return () => {
      const set = this.guardianSubscribers.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.guardianSubscribers.delete(key);
      }
    };
  }

  /**
   * Emits an event to all guardians who have an ACCEPTED link with `dependentEmail`.
   * RBAC is enforced here: only verified guardians receive events.
   *
   * @param dependentEmail  The user whose telemetry changed.
   * @param event           The guardian event to broadcast.
   */
  public emitToGuardians(dependentEmail: string, event: GuardianEvent): void {
    // Find all guardians who have accepted links with this dependent
    // We walk all subscriber keys and check their active links
    for (const [guardianEmail, callbacks] of this.guardianSubscribers.entries()) {
      const activeLinks = getActiveLinksForGuardian(guardianEmail);
      const hasAccess = activeLinks.some(
        l => l.dependentEmail.toLowerCase() === dependentEmail.toLowerCase()
      );
      if (!hasAccess) continue;

      callbacks.forEach(cb => {
        try {
          cb(event);
        } catch (err) {
          console.error(`[GuardianBroadcaster] Error dispatching to ${guardianEmail}:`, err);
        }
      });
    }
  }

  /** Returns the number of active guardian SSE subscriptions. */
  public get subscriberCount(): number {
    let count = 0;
    this.guardianSubscribers.forEach(set => { count += set.size; });
    return count;
  }
}

// Global singleton
export const guardianBroadcaster = new GuardianBroadcasterClass();

// ─── EVENT FACTORY HELPERS ────────────────────────────────────────────────────

function makeId(): string {
  return `ge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function buildLocationEvent(
  dependentEmail: string,
  dependentName: string,
  payload: GuardianLocationPayload
): GuardianEvent {
  return {
    id: makeId(),
    type: 'LOCATION_UPDATE',
    dependentEmail,
    dependentName,
    timestamp: new Date().toISOString(),
    payload,
    message: `📍 ${dependentName} is navigating to ${payload.destination}.`,
  };
}

export function buildDeviationEvent(
  dependentEmail: string,
  dependentName: string,
  payload: GuardianDeviationPayload
): GuardianEvent {
  return {
    id: makeId(),
    type: 'ROUTE_DEVIATION',
    dependentEmail,
    dependentName,
    timestamp: new Date().toISOString(),
    payload,
    message: `⚠️ ROUTE DEVIATION: ${dependentName} is ${payload.distanceMeters}m off planned route near ${payload.destination}.`,
  };
}

export function buildStopEvent(
  dependentEmail: string,
  dependentName: string,
  payload: GuardianStopPayload
): GuardianEvent {
  const minutes = Math.round(payload.stopDurationMs / 60000);
  return {
    id: makeId(),
    type: 'PROLONGED_STOP',
    dependentEmail,
    dependentName,
    timestamp: new Date().toISOString(),
    payload,
    message: `🛑 PROLONGED STOP: ${dependentName} has not moved for ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
  };
}

export function buildSosEvent(
  dependentEmail: string,
  dependentName: string,
  payload: GuardianSosPayload
): GuardianEvent {
  return {
    id: makeId(),
    type: 'SOS_TRIGGER',
    dependentEmail,
    dependentName,
    timestamp: new Date().toISOString(),
    payload,
    message: `🆘 EMERGENCY SOS! ${dependentName} pressed the panic button. Immediate assistance required.`,
  };
}

export function buildTripStartedEvent(
  dependentEmail: string,
  dependentName: string,
  payload: GuardianLocationPayload
): GuardianEvent {
  return {
    id: makeId(),
    type: 'TRIP_STARTED',
    dependentEmail,
    dependentName,
    timestamp: new Date().toISOString(),
    payload,
    message: `🟢 ${dependentName} started a trip from ${payload.origin} to ${payload.destination}.`,
  };
}

export function buildTripEndedEvent(
  dependentEmail: string,
  dependentName: string,
  tripStatus: string,
  destination: string
): GuardianEvent {
  return {
    id: makeId(),
    type: 'TRIP_ENDED',
    dependentEmail,
    dependentName,
    timestamp: new Date().toISOString(),
    payload: { tripStatus, destination },
    message:
      tripStatus === 'SOS'
        ? `🆘 SOS trip ended for ${dependentName}. Check in immediately.`
        : `✅ ${dependentName} completed trip to ${destination}.`,
  };
}
