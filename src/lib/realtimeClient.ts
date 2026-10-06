/**
 * PathFinder Access - Real-Time Client Event Handler
 *
 * Connects to SSE stream / WebSocket publisher with automatic reconnection
 * and bidirectional sync with the local barrierBroadcaster.
 */

import {
  barrierBroadcaster,
  BarrierEvent,
  BarrierAheadAlertPayload,
  ConfirmationPromptPayload,
  ReroutePayload,
} from './realtimeEngine';

export type BarrierAheadHandler = (payload: BarrierAheadAlertPayload) => void;
export type RouteRecalculatedHandler = (payload: ReroutePayload) => void;
export type ConfirmationPromptHandler = (payload: ConfirmationPromptPayload) => void;
export type AnyEventHandler = (event: BarrierEvent) => void;

export class RealtimeClient {
  private eventSource: EventSource | null = null;
  private sessionId?: string;
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  private barrierAheadHandlers: Set<BarrierAheadHandler> = new Set();
  private routeRecalculatedHandlers: Set<RouteRecalculatedHandler> = new Set();
  private confirmationPromptHandlers: Set<ConfirmationPromptHandler> = new Set();
  private anyEventHandlers: Set<AnyEventHandler> = new Set();

  private unsubscribeLocal?: () => void;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;

    // Bridge with in-memory barrierBroadcaster (zero network latency fallback)
    this.unsubscribeLocal = barrierBroadcaster.subscribe(event => {
      this.dispatchEvent(event);
    });
  }

  /**
   * Connect to Server-Sent Events stream if running in browser.
   */
  public connect(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `/api/events/sse${this.sessionId ? `?sessionId=${encodeURIComponent(this.sessionId)}` : ''}`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Exponential backoff reconnect
        const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts++));
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      };

      // Listen for specific event types from SSE
      const eventTypes = [
        'BARRIER_AHEAD_ALERT',
        'ROUTE_RECALCULATED',
        'CONFIRMATION_PROMPT',
        'BARRIER_ACTIVATED',
        'BARRIER_CONFIRMED',
        'BARRIER_EXPIRED',
        'REROUTE_EMITTED',
        'ALERT_PUSHED',
      ];

      for (const type of eventTypes) {
        this.eventSource.addEventListener(type, (msg: MessageEvent) => {
          try {
            const data: BarrierEvent = JSON.parse(msg.data);
            this.dispatchEvent(data);
          } catch (e) {
            console.error('[RealtimeClient] Failed to parse SSE event data', e);
          }
        });
      }
    } catch (e) {
      console.warn('[RealtimeClient] EventSource connection failed, running with in-memory broadcaster.', e);
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.unsubscribeLocal) {
      this.unsubscribeLocal();
    }
    this.isConnected = false;
  }

  /**
   * Internal dispatcher routing events to registered handlers.
   */
  public dispatchEvent(event: BarrierEvent): void {
    // Notify general listeners
    this.anyEventHandlers.forEach(h => h(event));

    // 1. BARRIER_AHEAD_ALERT
    if (event.type === 'BARRIER_AHEAD_ALERT' && event.barrierAhead) {
      this.barrierAheadHandlers.forEach(h => h(event.barrierAhead!));
    }

    // 2. ROUTE_RECALCULATED
    if (
      (event.type === 'ROUTE_RECALCULATED' || event.type === 'REROUTE_EMITTED') &&
      event.reroute
    ) {
      this.routeRecalculatedHandlers.forEach(h => h(event.reroute!));
    }

    // 3. CONFIRMATION_PROMPT
    if (event.type === 'CONFIRMATION_PROMPT' && event.confirmationPrompt) {
      this.confirmationPromptHandlers.forEach(h => h(event.confirmationPrompt!));
    }
  }

  // --------------------------------------------------------
  // SUBSCRIPTION METHODS
  // --------------------------------------------------------

  public onBarrierAhead(handler: BarrierAheadHandler): () => void {
    this.barrierAheadHandlers.add(handler);
    return () => {
      this.barrierAheadHandlers.delete(handler);
    };
  }

  public onRouteRecalculated(handler: RouteRecalculatedHandler): () => void {
    this.routeRecalculatedHandlers.add(handler);
    return () => {
      this.routeRecalculatedHandlers.delete(handler);
    };
  }

  public onConfirmationPrompt(handler: ConfirmationPromptHandler): () => void {
    this.confirmationPromptHandlers.add(handler);
    return () => {
      this.confirmationPromptHandlers.delete(handler);
    };
  }

  public onEvent(handler: AnyEventHandler): () => void {
    this.anyEventHandlers.add(handler);
    return () => {
      this.anyEventHandlers.delete(handler);
    };
  }
}

// Global Singleton Instance
export const realtimeClient = new RealtimeClient();
