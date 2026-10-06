/**
 * Location Cache - In-Memory Ring Buffer for Real-Time Location Fan-out
 *
 * Stores recent GPS pings per user/link in memory for instantaneous SSE broadcast
 * and zero-latency fetching on Caregiver Dashboard load.
 */

export interface LocationPing {
  userId: string;
  userEmail: string;
  lat: number;
  lng: number;
  accuracy: number;
  battery: number; // 0-100
  speed: number | null; // km/h
  heading: number | null;
  timestamp: string; // ISO string
}

const MAX_PING_HISTORY_PER_USER = 2880; // 1 ping per 30 sec for 24 hours
const locationRingBuffer = new Map<string, LocationPing[]>();
const latestLocationMap = new Map<string, LocationPing>();

export function recordLocationPing(ping: LocationPing): void {
  latestLocationMap.set(ping.userId, ping);
  latestLocationMap.set(ping.userEmail.toLowerCase(), ping);

  const history = locationRingBuffer.get(ping.userId) || [];
  history.push(ping);

  if (history.length > MAX_PING_HISTORY_PER_USER) {
    history.shift(); // Maintain 24-hour ring buffer
  }

  locationRingBuffer.set(ping.userId, history);
  locationRingBuffer.set(ping.userEmail.toLowerCase(), history);
}

export function getLatestLocation(userIdentifier: string): LocationPing | null {
  return latestLocationMap.get(userIdentifier.toLowerCase()) || null;
}

export function getLocationHistory24h(userIdentifier: string): LocationPing[] {
  return locationRingBuffer.get(userIdentifier.toLowerCase()) || [];
}
