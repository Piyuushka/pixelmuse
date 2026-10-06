import { IndianBarrierReport } from './barrierEngine';
import { RouteResult } from './routingEngine';

export type EventType =
  | 'BARRIER_REPORTED'
  | 'BARRIER_CONFIRMED'
  | 'BARRIER_ACTIVATED'
  | 'BARRIER_EXPIRED'
  | 'ROUTE_RECALCULATED'
  | 'ALERT_PUSHED'
  | 'REROUTE_EMITTED'
  | 'BARRIER_AHEAD_ALERT'
  | 'CONFIRMATION_PROMPT';

export interface ReroutePayload {
  sessionId: string;
  newPolyline: string;
  timeSaved: number;
  hazardType: string;
  newDistanceMeters?: number;
  newEtaMinutes?: number;
  originalEtaMinutes?: number;
  avoidsBlockage?: boolean;
}

export interface BarrierAheadAlertPayload {
  sessionId: string;
  barrierId: string;
  title: string;
  category: string;
  location: { lat: number; lng: number };
  distanceAheadMeters: number;
  estimatedDetourMinutes: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  roadLayer: string;
}

export interface ConfirmationPromptPayload {
  sessionId: string;
  barrierId: string;
  promptText: string;
  category: string;
  location: { lat: number; lng: number };
  distanceMeters: number;
  expiresInMinutes: number;
}

export interface BarrierEvent {
  id: string;
  type: EventType;
  timestamp: number;
  quadKey?: string;
  barrier?: IndianBarrierReport;
  routeResult?: RouteResult;
  reroute?: ReroutePayload;
  barrierAhead?: BarrierAheadAlertPayload;
  confirmationPrompt?: ConfirmationPromptPayload;
  message: string;
}

export type EventCallback = (event: BarrierEvent) => void;

class RealtimeBarrierBroadcaster {
  private subscribers: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    this.subscribers.set('ALL', new Set());
  }

  /**
   * Subscribe to all events or events in a specific spatial quadKey cell.
   */
  public subscribe(callback: EventCallback, quadKey: string = 'ALL'): () => void {
    if (!this.subscribers.has(quadKey)) {
      this.subscribers.set(quadKey, new Set());
    }
    const channel = this.subscribers.get(quadKey)!;
    channel.add(callback);

    // Return unsubscribe cleanup function
    return () => {
      channel.delete(callback);
    };
  }

  /**
   * Broadcasts an event to all global and cell-specific subscribers.
   */
  public broadcast(eventInput: Omit<BarrierEvent, 'id' | 'timestamp'>): BarrierEvent {
    const fullEvent: BarrierEvent = {
      ...eventInput,
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
    };

    // Notify global subscribers
    const globalChannel = this.subscribers.get('ALL');
    if (globalChannel) {
      globalChannel.forEach(cb => cb(fullEvent));
    }

    // Notify spatial cell subscribers if quadKey is provided
    if (fullEvent.quadKey && this.subscribers.has(fullEvent.quadKey)) {
      const cellChannel = this.subscribers.get(fullEvent.quadKey)!;
      cellChannel.forEach(cb => cb(fullEvent));
    }

    return fullEvent;
  }
}

// Global Singleton Instance
export const barrierBroadcaster = new RealtimeBarrierBroadcaster();
