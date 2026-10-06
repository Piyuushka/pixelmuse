/**
 * Capacitor Geolocation Wrapper
 * Uses native GPS on iOS/Android, falls back to Web Geolocation API on browsers.
 */
import { Geolocation, Position, PermissionStatus } from '@capacitor/geolocation';
import { isNativePlatform, isPluginAvailable } from './capacitor-platform';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

/**
 * Request geolocation permissions (required on native before first use).
 */
export async function requestGeoPermissions(): Promise<PermissionStatus> {
  if (isNativePlatform() && isPluginAvailable('Geolocation')) {
    return Geolocation.requestPermissions();
  }
  // On web, permissions are requested automatically on first call
  return { location: 'granted', coarseLocation: 'granted' } as PermissionStatus;
}

/**
 * Get current position once.
 */
export async function getCurrentPosition(): Promise<GeoPosition> {
  if (isNativePlatform() && isPluginAvailable('Geolocation')) {
    const pos: Position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    return mapPosition(pos);
  }

  // Web fallback
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(mapWebPosition(pos)),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/**
 * Watch position continuously. Returns an ID to clear the watch.
 */
export async function watchPosition(
  callback: (pos: GeoPosition) => void,
  errorCallback?: (err: Error) => void
): Promise<string> {
  if (isNativePlatform() && isPluginAvailable('Geolocation')) {
    const watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (position, err) => {
        if (err) {
          errorCallback?.(new Error(err.message));
          return;
        }
        if (position) {
          callback(mapPosition(position));
        }
      }
    );
    return watchId;
  }

  // Web fallback
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => callback(mapWebPosition(pos)),
      (err) => errorCallback?.(new Error(err.message)),
      { enableHighAccuracy: true }
    );
    resolve(String(id));
  });
}

/**
 * Clear a position watch.
 */
export async function clearWatch(watchId: string): Promise<void> {
  if (isNativePlatform() && isPluginAvailable('Geolocation')) {
    await Geolocation.clearWatch({ id: watchId });
    return;
  }
  navigator.geolocation.clearWatch(parseInt(watchId, 10));
}

// ── Internal Mappers ──

function mapPosition(pos: Position): GeoPosition {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
    speed: pos.coords.speed,
    heading: pos.coords.heading,
    timestamp: pos.timestamp,
  };
}

function mapWebPosition(pos: GeolocationPosition): GeoPosition {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
    speed: pos.coords.speed,
    heading: pos.coords.heading,
    timestamp: pos.timestamp,
  };
}
