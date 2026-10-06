/**
 * PathFinder Access — Guardian Anomaly Detection Engine
 *
 * Pure-TypeScript server-side coordinate analysis functions.
 * No external dependencies — uses Haversine geometry for all distance calculations.
 *
 * Emits three anomaly types:
 *  - ROUTE_DEVIATION : Live GPS ping deviates >150m from planned routeGeometry
 *  - PROLONGED_STOP  : GPS coordinates remain static for >5 minutes during ACTIVE trip
 *  - SOS_TRIGGER     : Emitted instantly upon panic button press (handled separately)
 */

import { Trip } from './db/userStore';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

/** Maximum allowed off-route distance in meters before ROUTE_DEVIATION fires. */
const DEVIATION_THRESHOLD_METERS = 150;

/** Minimum time (ms) user must remain static before PROLONGED_STOP fires. */
const PROLONGED_STOP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/** Movement threshold below which the user is considered "static" (meters). */
const STATIC_MOVEMENT_THRESHOLD_METERS = 15;

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type AnomalyType = 'ROUTE_DEVIATION' | 'PROLONGED_STOP' | 'SOS_TRIGGER';

export interface DeviationResult {
  isDeviated: boolean;
  distanceMeters: number;
  nearestRoutePoint: { lat: number; lng: number } | null;
}

export interface ProlongedStopResult {
  isStopped: boolean;
  stopDurationMs: number;
  staticSince: string | null; // ISO timestamp when movement stopped
}

// ─── HAVERSINE MATH HELPERS ───────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Haversine great-circle distance between two WGS-84 coordinates.
 * Returns distance in metres.
 */
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLng = (b.lng - a.lng) * DEG2RAD;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(a.lat * DEG2RAD) * Math.cos(b.lat * DEG2RAD) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Finds the closest point on a line segment [segA, segB] to `point`.
 * Returns the closest point coordinates (may be segA, segB, or a point on the segment).
 */
function closestPointOnSegment(
  point: { lat: number; lng: number },
  segA: { lat: number; lng: number },
  segB: { lat: number; lng: number }
): { lat: number; lng: number } {
  // Use a flat-earth approximation — valid for short segments (<1km)
  const ax = segA.lng;
  const ay = segA.lat;
  const bx = segB.lng;
  const by = segB.lat;
  const px = point.lng;
  const py = point.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return segA; // zero-length segment

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  return { lat: ay + t * aby, lng: ax + t * abx };
}

/**
 * Minimum perpendicular distance from `point` to ANY segment in the polyline.
 * Returns the distance in metres and the nearest route point.
 */
function minDistanceToPolyline(
  point: { lat: number; lng: number },
  polyline: Array<{ lat: number; lng: number }>
): { distanceMeters: number; nearestPoint: { lat: number; lng: number } | null } {
  if (polyline.length === 0) return { distanceMeters: Infinity, nearestPoint: null };
  if (polyline.length === 1) {
    return {
      distanceMeters: haversineDistance(point, polyline[0]),
      nearestPoint: polyline[0],
    };
  }

  let minDist = Infinity;
  let nearest: { lat: number; lng: number } | null = null;

  for (let i = 0; i < polyline.length - 1; i++) {
    const cp = closestPointOnSegment(point, polyline[i], polyline[i + 1]);
    const d = haversineDistance(point, cp);
    if (d < minDist) {
      minDist = d;
      nearest = cp;
    }
  }

  return { distanceMeters: minDist, nearestPoint: nearest };
}

// ─── ANOMALY DETECTION FUNCTIONS ──────────────────────────────────────────────

/**
 * ROUTE_DEVIATION detector.
 *
 * Returns `isDeviated: true` if the current GPS coordinate is more than
 * DEVIATION_THRESHOLD_METERS (150m) from the nearest point on the planned
 * route geometry.
 *
 * @param currentCoords  Live GPS ping from dependent's device.
 * @param routeGeometry  The planned route as an ordered array of [lat, lng] waypoints.
 */
export function checkRouteDeviation(
  currentCoords: { lat: number; lng: number },
  routeGeometry: Array<{ lat: number; lng: number }>
): DeviationResult {
  if (routeGeometry.length === 0) {
    return { isDeviated: false, distanceMeters: 0, nearestRoutePoint: null };
  }

  const { distanceMeters, nearestPoint } = minDistanceToPolyline(currentCoords, routeGeometry);

  return {
    isDeviated: distanceMeters > DEVIATION_THRESHOLD_METERS,
    distanceMeters: Math.round(distanceMeters),
    nearestRoutePoint: nearestPoint,
  };
}

/**
 * PROLONGED_STOP detector.
 *
 * Analyses the trip's recent ping history to determine if the user has been
 * stationary for longer than PROLONGED_STOP_THRESHOLD_MS (5 minutes).
 *
 * Strategy: Walk back through the last N pings; find the oldest ping that is
 * within STATIC_MOVEMENT_THRESHOLD_METERS (15m) of the current location.
 * If the time window from that ping to now exceeds the threshold → fire.
 *
 * @param trip  The current ACTIVE trip record from the database.
 */
export function checkProlongedStop(trip: Trip): ProlongedStopResult {
  const pings = trip.pings;
  const currentCoords = trip.lastCoords;

  if (!currentCoords || pings.length < 2) {
    return { isStopped: false, stopDurationMs: 0, staticSince: null };
  }

  const now = Date.now();
  let staticSinceMs: number | null = null;

  // Walk backwards from the oldest ping to find when movement stopped
  for (let i = pings.length - 2; i >= 0; i--) {
    const ping = pings[i];
    const dist = haversineDistance(currentCoords, { lat: ping.lat, lng: ping.lng });

    if (dist <= STATIC_MOVEMENT_THRESHOLD_METERS) {
      // This ping is close enough — user was already stopped here
      staticSinceMs = new Date(ping.ts).getTime();
    } else {
      // Movement detected — stop walking back
      break;
    }
  }

  if (staticSinceMs === null) {
    return { isStopped: false, stopDurationMs: 0, staticSince: null };
  }

  const stopDurationMs = now - staticSinceMs;
  const isStopped = stopDurationMs >= PROLONGED_STOP_THRESHOLD_MS;

  return {
    isStopped,
    stopDurationMs,
    staticSince: new Date(staticSinceMs).toISOString(),
  };
}

/**
 * Runs all anomaly checks on a single GPS ping and returns a list of
 * fired anomaly types. Designed to be called from the telemetry API route.
 */
export function analyseGpsPing(
  coords: { lat: number; lng: number },
  trip: Trip
): {
  anomalies: AnomalyType[];
  deviation: DeviationResult;
  stop: ProlongedStopResult;
} {
  const anomalies: AnomalyType[] = [];

  const deviation = checkRouteDeviation(coords, trip.routeGeometry);
  if (deviation.isDeviated) anomalies.push('ROUTE_DEVIATION');

  const stop = checkProlongedStop(trip);
  if (stop.isStopped) anomalies.push('PROLONGED_STOP');

  return { anomalies, deviation, stop };
}
