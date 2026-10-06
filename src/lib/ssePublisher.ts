/**
 * PathFinder Access - Real-Time SSE & WebSocket Publisher
 *
 * Requirements fulfilled:
 * 1. Broadcasts barrier events:
 *    - `BARRIER_AHEAD_ALERT` (when user approaches a barrier within 1 km).
 *    - `ROUTE_RECALCULATED` (when a faster/safer path is found around a newly confirmed barrier).
 *    - `CONFIRMATION_PROMPT` (asks user "Is this flooded road still blocked?" when passing near an expiring barrier).
 * 2. Pipes events to connected Server-Sent Events (SSE) and WebSocket streams.
 */

import { Coordinates, calculateHaversineDistance } from './spatial';
import { closestPointOnSegment } from './h3Indexer';
import { IndianBarrierReport } from './barrierEngine';
import { NavigationSession, sessionRegistry } from './navigationSessionRegistry';
import {
  barrierBroadcaster,
  BarrierEvent,
  BarrierAheadAlertPayload,
  ConfirmationPromptPayload,
  ReroutePayload,
} from './realtimeEngine';

export interface SSEClient {
  id: string;
  sessionId?: string;
  send: (formattedChunk: string) => void;
  close: () => void;
}

export class SSEPublisher {
  private clients: Map<string, SSEClient> = new Map();
  private promptedBarriersPerSession: Map<string, Set<string>> = new Map();
  private alertedBarriersPerSession: Map<string, Set<string>> = new Map();

  constructor() {
    // Pipe all internal barrierBroadcaster events to SSE clients
    barrierBroadcaster.subscribe(event => {
      this.publishToClients(event);
    });
  }

  /**
   * Registers an open SSE / WebSocket client stream.
   */
  public registerClient(client: SSEClient): () => void {
    this.clients.set(client.id, client);

    // Send initial connection handshake frame
    client.send(
      this.formatSSE({
        id: `init-${Date.now()}`,
        type: 'ALERT_PUSHED',
        timestamp: Date.now(),
        message: 'Real-time barrier event stream connected.',
      })
    );

    return () => {
      this.clients.delete(client.id);
    };
  }

  public get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Formats a BarrierEvent into standard SSE text frame format:
   * event: <type>\ndata: <json>\n\n
   */
  public formatSSE(event: BarrierEvent): string {
    return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  /**
   * Pushes an event to all connected clients (or clients filtered by sessionId).
   */
  public publishToClients(event: BarrierEvent, targetSessionId?: string): void {
    const sseChunk = this.formatSSE(event);
    for (const client of this.clients.values()) {
      if (!targetSessionId || !client.sessionId || client.sessionId === targetSessionId) {
        try {
          client.send(sseChunk);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  // ============================================================
  // PROXIMITY & EXPIRATION SCANNER
  // Evaluates navigating sessions against active barriers
  // ============================================================

  /**
   * Evaluates proximity of a navigating session against barriers to broadcast:
   * 1. `BARRIER_AHEAD_ALERT`: When barrier is within 1000m ahead.
   * 2. `CONFIRMATION_PROMPT`: When passing within 150m of an expiring barrier.
   */
  public evaluateSessionProximity(
    session: NavigationSession,
    activeBarriers: IndianBarrierReport[]
  ): BarrierEvent[] {
    const emittedEvents: BarrierEvent[] = [];
    const sessionId = session.sessionId;

    if (!this.promptedBarriersPerSession.has(sessionId)) {
      this.promptedBarriersPerSession.set(sessionId, new Set());
    }
    if (!this.alertedBarriersPerSession.has(sessionId)) {
      this.alertedBarriersPerSession.set(sessionId, new Set());
    }

    const promptedSet = this.promptedBarriersPerSession.get(sessionId)!;
    const alertedSet = this.alertedBarriersPerSession.get(sessionId)!;

    const remainingCoords = session.routeCoords.slice(session.currentPositionIndex);
    if (remainingCoords.length < 2) return [];

    const now = Date.now();

    for (const barrier of activeBarriers) {
      if (barrier.isExpired || barrier.status === 'Expired') continue;

      // Layer mismatch guard (flyover vs service road)
      const sessionLayer = session.roadLayer.toLowerCase();
      if (
        (barrier.roadLayer === 'flyover' && sessionLayer !== 'flyover') ||
        (barrier.roadLayer === 'service_road' && sessionLayer === 'flyover')
      ) {
        continue;
      }

      // Check distance from current GPS position and along remaining route segments
      let minDistanceToRemainingRoute = Infinity;
      for (let i = 0; i < remainingCoords.length - 1; i++) {
        const p1 = remainingCoords[i];
        const p2 = remainingCoords[i + 1];
        const nearest = closestPointOnSegment(barrier.coordinates, p1, p2);
        const d = calculateHaversineDistance(barrier.coordinates, nearest);
        if (d < minDistanceToRemainingRoute) {
          minDistanceToRemainingRoute = d;
        }
      }

      const directDistFromUser = calculateHaversineDistance(
        session.currentGpsCoord,
        barrier.coordinates
      );

      // ── 1. BARRIER_AHEAD_ALERT (within 1 km ahead on route) ─────────
      // If barrier is on route (corridor <= 50m) and within 1000m ahead
      if (
        directDistFromUser <= 1000 &&
        minDistanceToRemainingRoute <= 60 &&
        !alertedSet.has(barrier.id)
      ) {
        alertedSet.add(barrier.id);

        const detourMinutes = barrier.severity === 'critical' ? 5 : 3;
        const alertPayload: BarrierAheadAlertPayload = {
          sessionId,
          barrierId: barrier.id,
          title: barrier.title,
          category: barrier.category,
          location: barrier.coordinates,
          distanceAheadMeters: Math.round(directDistFromUser),
          estimatedDetourMinutes: detourMinutes,
          severity: barrier.severity,
          urgency: directDistFromUser < 300 ? 'critical' : directDistFromUser < 600 ? 'high' : 'medium',
          roadLayer: barrier.roadLayer,
        };

        const alertEvent = barrierBroadcaster.broadcast({
          type: 'BARRIER_AHEAD_ALERT',
          barrier,
          barrierAhead: alertPayload,
          message: `⚠️ Hazard Ahead: ${barrier.title} (${Math.round(directDistFromUser)}m ahead). Detour +${detourMinutes} min.`,
        });

        emittedEvents.push(alertEvent);
      }

      // ── 2. CONFIRMATION_PROMPT (near expiring barrier <= 150m) ──────
      // User is within 150m of an expiring barrier (TTL <= 30 min or flooding)
      const remainingMinutes = Math.max(0, Math.floor((barrier.expiresAt - now) / 60000));
      const isExpiringSoon = remainingMinutes <= 45 || barrier.ttlSeconds <= 2700;
      const isFlooded = barrier.category.toLowerCase().includes('flood') || barrier.category.toLowerCase().includes('waterlog');

      if (
        directDistFromUser <= 150 &&
        (isExpiringSoon || isFlooded) &&
        !promptedSet.has(barrier.id)
      ) {
        promptedSet.add(barrier.id);

        const promptText = isFlooded
          ? 'Is this flooded road still blocked?'
          : `Is this ${barrier.category.toLowerCase()} still blocked?`;

        const promptPayload: ConfirmationPromptPayload = {
          sessionId,
          barrierId: barrier.id,
          promptText,
          category: barrier.category,
          location: barrier.coordinates,
          distanceMeters: Math.round(directDistFromUser),
          expiresInMinutes: remainingMinutes,
        };

        const promptEvent = barrierBroadcaster.broadcast({
          type: 'CONFIRMATION_PROMPT',
          barrier,
          confirmationPrompt: promptPayload,
          message: `[Community Verification] ${promptText} (${barrier.title})`,
        });

        emittedEvents.push(promptEvent);
      }
    }

    return emittedEvents;
  }

  /**
   * Scans all currently active navigation sessions in registry against active barriers.
   */
  public scanAllActiveSessions(activeBarriers: IndianBarrierReport[]): BarrierEvent[] {
    const allEvents: BarrierEvent[] = [];
    const sessions = sessionRegistry.getAllActiveSessions();

    for (const session of sessions) {
      const events = this.evaluateSessionProximity(session, activeBarriers);
      allEvents.push(...events);
    }

    return allEvents;
  }
}

// Global Singleton Instance
export const ssePublisher = new SSEPublisher();
