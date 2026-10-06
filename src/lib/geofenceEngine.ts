/**
 * Geofence Engine — Safety Zone & Curfew Evaluation
 *
 * Checks if a GPS point (lat, lng) falls inside a circular geofence
 * or outside a defined safe area, and validates curfew windows.
 */

export interface GeofenceZone {
  id: string;
  linkId: string;
  name: string; // e.g. "Home", "School", "Workplace"
  center: { lat: number; lng: number };
  radiusMeters: number;
  type: 'SAFE' | 'RESTRICTED';
  activeCurfewStart?: string; // e.g. "20:00"
  activeCurfewEnd?: string;   // e.g. "06:00"
  createdAt: string;
}

/**
 * Calculates Haversine distance in meters between two lat/lng pairs.
 */
export function getHaversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates whether current coordinates are inside a circular geofence.
 */
export function isPointInGeofence(
  lat: number,
  lng: number,
  zone: GeofenceZone
): boolean {
  const dist = getHaversineDistanceMeters(lat, lng, zone.center.lat, zone.center.lng);
  return dist <= zone.radiusMeters;
}

/**
 * Evaluates if current local time falls within a curfew window (e.g., 22:00 to 06:00).
 */
export function isCurfewActive(startTimeStr?: string, endTimeStr?: string): boolean {
  if (!startTimeStr || !endTimeStr) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Curfew crosses midnight (e.g. 22:00 to 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}
