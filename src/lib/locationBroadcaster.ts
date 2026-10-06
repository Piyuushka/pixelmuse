import { EventEmitter } from 'events';

export interface LocationPing {
  userId?: string;
  userEmail: string;
  name?: string;
  lat: number;
  lng: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  batteryLevel?: number | null;
  isCharging?: boolean;
  status?: 'ACTIVE' | 'IDLE' | 'SOS' | 'PAUSED';
  timestamp: string;
}

export interface SOSEvent {
  id: string;
  userEmail: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  status: 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED';
  triggeredAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  message?: string;
}

export interface BreadcrumbPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

// Global cache for live locations and SOS events
// In Next.js dev server, use globalThis to survive HMR reloads
const globalLocationStore = globalThis as unknown as {
  __locationBroadcasterInstance?: EventEmitter;
  __latestLocations?: Map<string, LocationPing>;
  __locationHistory?: Map<string, BreadcrumbPoint[]>;
  __activeSOSEvents?: Map<string, SOSEvent>;
};

if (!globalLocationStore.__locationBroadcasterInstance) {
  globalLocationStore.__locationBroadcasterInstance = new EventEmitter();
  globalLocationStore.__locationBroadcasterInstance.setMaxListeners(200);
}
if (!globalLocationStore.__latestLocations) {
  globalLocationStore.__latestLocations = new Map();
}
if (!globalLocationStore.__locationHistory) {
  globalLocationStore.__locationHistory = new Map();
}
if (!globalLocationStore.__activeSOSEvents) {
  globalLocationStore.__activeSOSEvents = new Map();
}

const emitter = globalLocationStore.__locationBroadcasterInstance;
const latestLocations = globalLocationStore.__latestLocations;
const locationHistory = globalLocationStore.__locationHistory;
const activeSOSEvents = globalLocationStore.__activeSOSEvents;

// Helper channel name generator
function getUserChannel(userEmail: string) {
  return `location:${userEmail.toLowerCase().trim()}`;
}

function getSOSChannel() {
  return 'sos:broadcast';
}

export const locationBroadcaster = {
  /**
   * Publish a location update for a user.
   */
  publishLocation(ping: LocationPing) {
    const email = ping.userEmail.toLowerCase().trim();
    latestLocations.set(email, ping);

    // Append to breadcrumb history (cap at 100 points)
    const history = locationHistory.get(email) || [];
    history.push({
      lat: ping.lat,
      lng: ping.lng,
      timestamp: ping.timestamp,
    });
    if (history.length > 100) {
      history.shift();
    }
    locationHistory.set(email, history);

    // Emit on specific user channel
    emitter.emit(getUserChannel(email), {
      type: 'LOCATION_UPDATE',
      data: ping,
      history,
    });

    // Also emit a general update
    emitter.emit('all:locations', {
      type: 'LOCATION_UPDATE',
      data: ping,
    });
  },

  /**
   * Get the latest location ping for a user.
   */
  getLatestLocation(userEmail: string): LocationPing | null {
    return latestLocations.get(userEmail.toLowerCase().trim()) || null;
  },

  /**
   * Get recent breadcrumbs for a user.
   */
  getHistory(userEmail: string): BreadcrumbPoint[] {
    return locationHistory.get(userEmail.toLowerCase().trim()) || [];
  },

  /**
   * Subscribe to location updates for a specific dependent.
   */
  subscribeToUser(
    userEmail: string,
    callback: (event: { type: string; data: LocationPing; history?: BreadcrumbPoint[] }) => void
  ) {
    const channel = getUserChannel(userEmail);
    emitter.on(channel, callback);
    return () => {
      emitter.off(channel, callback);
    };
  },

  /**
   * Trigger an SOS alert.
   */
  triggerSOS(sos: SOSEvent) {
    const email = sos.userEmail.toLowerCase().trim();
    activeSOSEvents.set(email, sos);

    const payload = {
      type: 'SOS_ALERT',
      data: sos,
    };

    emitter.emit(getUserChannel(email), payload);
    emitter.emit(getSOSChannel(), payload);
  },

  /**
   * Acknowledge an active SOS alert.
   */
  acknowledgeSOS(userEmail: string, caregiverName: string) {
    const email = userEmail.toLowerCase().trim();
    const sos = activeSOSEvents.get(email);
    if (sos) {
      sos.status = 'ACKNOWLEDGED';
      sos.acknowledgedAt = new Date().toISOString();
      sos.acknowledgedBy = caregiverName;
      activeSOSEvents.set(email, sos);

      const payload = {
        type: 'SOS_ACKNOWLEDGED',
        data: sos,
      };
      emitter.emit(getUserChannel(email), payload);
      emitter.emit(getSOSChannel(), payload);
    }
    return sos;
  },

  /**
   * Resolve an active SOS alert.
   */
  resolveSOS(userEmail: string, resolverName: string) {
    const email = userEmail.toLowerCase().trim();
    const sos = activeSOSEvents.get(email);
    if (sos) {
      sos.status = 'RESOLVED';
      sos.resolvedAt = new Date().toISOString();
      sos.resolvedBy = resolverName;
      activeSOSEvents.delete(email);

      const payload = {
        type: 'SOS_RESOLVED',
        data: sos,
      };
      emitter.emit(getUserChannel(email), payload);
      emitter.emit(getSOSChannel(), payload);
    }
    return sos;
  },

  /**
   * Get active SOS for a user.
   */
  getActiveSOS(userEmail: string): SOSEvent | null {
    return activeSOSEvents.get(userEmail.toLowerCase().trim()) || null;
  },

  /**
   * Subscribe to global SOS broadcasts.
   */
  subscribeToSOS(callback: (event: { type: string; data: SOSEvent }) => void) {
    emitter.on(getSOSChannel(), callback);
    return () => {
      emitter.off(getSOSChannel(), callback);
    };
  },
};
