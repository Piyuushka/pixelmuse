/**
 * PathFinder Access - WebSocket & SSE Real-time Publisher / Server
 *
 * Requirements fulfilled:
 * 1. Broadcasts barrier events:
 *    - `BARRIER_AHEAD_ALERT` (when user approaches a barrier within 1 km).
 *    - `ROUTE_RECALCULATED` (when a faster/safer path is found around a newly confirmed barrier).
 *    - `CONFIRMATION_PROMPT` (asks user "Is this flooded road still blocked?" when passing near an expiring barrier).
 * 2. Provides unified WebSocket / SSE connection abstraction with subscription filtering and client session registry.
 */

import { IndianBarrierReport } from './barrierEngine';
import {
  barrierBroadcaster,
  BarrierEvent,
  BarrierAheadAlertPayload,
  ConfirmationPromptPayload,
  ReroutePayload,
} from './realtimeEngine';
import { NavigationSession, sessionRegistry } from './navigationSessionRegistry';
import { closestPointOnSegment } from './h3Indexer';
import { calculateHaversineDistance } from './spatial';

export type SocketTransport = 'websocket' | 'sse' | 'memory';

export interface ConnectedSocketClient {
  id: string;
  sessionId?: string;
  transport: SocketTransport;
  send: (payload: string | BarrierEvent) => void;
  close: () => void;
  subscribedQuadKeys?: Set<string>;
}

export class RealtimePublisher {
  private clients: Map<string, ConnectedSocketClient> = new Map();
  private sessionToClients: Map<string, Set<string>> = new Map();
  private promptedBarriersPerSession: Map<string, Set<string>> = new Map();
  private alertedBarriersPerSession: Map<string, Set<string>> = new Map();

  constructor() {
    // Pipe all events emitted by barrierBroadcaster to registered socket/SSE clients
    barrierBroadcaster.subscribe(event => {
      this.broadcast(event);
    });
  }

  /**
   * Register a new connected WebSocket or SSE client.
   */
  public registerClient(client: ConnectedSocketClient): () => void {
    this.clients.set(client.id, client);

    if (client.sessionId) {
      if (!this.sessionToClients.has(client.sessionId)) {
        this.sessionToClients.set(client.sessionId, new Set());
      }
      this.sessionToClients.get(client.sessionId)!.add(client.id);
    }

    // Send connection established frame
    client.send(
      JSON.stringify({
        id: `conn-${Date.now()}`,
        type: 'ALERT_PUSHED',
        timestamp: Date.now(),
        message: 'Real-time WebSocket/SSE barrier publisher connected.',
      })
    );

    return () => {
      this.unregisterClient(client.id);
    };
  }

  public unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.sessionId && this.sessionToClients.has(client.sessionId)) {
      const set = this.sessionToClients.get(client.sessionId)!;
      set.delete(clientId);
      if (set.size === 0) {
        this.sessionToClients.delete(client.sessionId);
      }
    }

    this.clients.delete(clientId);
  }

  public get clientCount(): number {
    return this.clients.size;
  }

  // ============================================================
  // BROADCAST METHODS
  // ============================================================

  /**
   * Universal broadcast method. Serializes and sends event to all or targeted clients.
   */
  public broadcast(event: BarrierEvent, targetSessionId?: string): void {
    const rawPayload = JSON.stringify(event);
    const sseChunk = `event: ${event.type}\ndata: ${rawPayload}\n\n`;

    if (targetSessionId) {
      const clientIds = this.sessionToClients.get(targetSessionId);
      if (clientIds) {
        for (const cid of clientIds) {
          const client = this.clients.get(cid);
          if (client) {
            try {
              client.send(client.transport === 'sse' ? sseChunk : rawPayload);
            } catch {
              this.unregisterClient(cid);
            }
          }
        }
      }
      return;
    }

    // Global broadcast
    for (const [cid, client] of this.clients.entries()) {
      try {
        client.send(client.transport === 'sse' ? sseChunk : rawPayload);
      } catch {
        this.unregisterClient(cid);
      }
    }
  }

  /**
   * Broadcast BARRIER_AHEAD_ALERT: When user approaches a barrier within 1 km.
   */
  public emitBarrierAheadAlert(payload: BarrierAheadAlertPayload, barrier?: IndianBarrierReport): BarrierEvent {
    return barrierBroadcaster.broadcast({
      type: 'BARRIER_AHEAD_ALERT',
      barrier,
      barrierAhead: payload,
      message: `⚠️ Hazard Ahead: ${payload.title} (${payload.distanceAheadMeters}m ahead). Estimated detour: +${payload.estimatedDetourMinutes} min.`,
    });
  }

  /**
   * Broadcast ROUTE_RECALCULATED: When a faster/safer path is found around a newly confirmed barrier.
   */
  public emitRouteRecalculated(payload: ReroutePayload, barrier?: IndianBarrierReport): BarrierEvent {
    return barrierBroadcaster.broadcast({
      type: 'ROUTE_RECALCULATED',
      barrier,
      reroute: payload,
      message: `🔄 Route Recalculated: Alternative path avoids ${payload.hazardType}, saving ${payload.timeSaved} minutes.`,
    });
  }

  /**
   * Broadcast CONFIRMATION_PROMPT: Asks user "Is this flooded road still blocked?" when passing near an expiring barrier.
   */
  public emitConfirmationPrompt(payload: ConfirmationPromptPayload, barrier?: IndianBarrierReport): BarrierEvent {
    return barrierBroadcaster.broadcast({
      type: 'CONFIRMATION_PROMPT',
      barrier,
      confirmationPrompt: payload,
      message: `💬 Community Verification: "${payload.promptText}" (${Math.round(payload.distanceMeters)}m away)`,
    });
  }

  // ============================================================
  // REAL-TIME SPATIAL SCANNER: BARRIER_AHEAD & CONFIRMATION_PROMPT
  // ============================================================

  /**
   * Scans a specific navigation session against active barriers.
   */
  public scanSessionForAlerts(session: NavigationSession, activeBarriers: IndianBarrierReport[]): BarrierEvent[] {
    const emitted: BarrierEvent[] = [];
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

      // ── 1. BARRIER_AHEAD_ALERT (approaching within 1 km) ───────────
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

        const evt = this.emitBarrierAheadAlert(alertPayload, barrier);
        emitted.push(evt);
      }

      // ── 2. CONFIRMATION_PROMPT (passing near expiring/flooded barrier <= 150m) ──
      const remainingMinutes = Math.max(0, Math.floor((barrier.expiresAt - now) / 60000));
      const isExpiringSoon = remainingMinutes <= 45 || barrier.ttlSeconds <= 2700;
      const isFlooded =
        barrier.category.toLowerCase().includes('flood') ||
        barrier.category.toLowerCase().includes('waterlog');

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

        const evt = this.emitConfirmationPrompt(promptPayload, barrier);
        emitted.push(evt);
      }
    }

    return emitted;
  }

  /**
   * Scans all currently registered navigation sessions against active barriers.
   */
  public scanAllActiveSessions(activeBarriers: IndianBarrierReport[]): BarrierEvent[] {
    const allEvents: BarrierEvent[] = [];
    const sessions = sessionRegistry.getAllActiveSessions();

    for (const session of sessions) {
      const events = this.scanSessionForAlerts(session, activeBarriers);
      allEvents.push(...events);
    }

    return allEvents;
  }
}

// Global Singleton Instance
export const wsPublisher = new RealtimePublisher();
