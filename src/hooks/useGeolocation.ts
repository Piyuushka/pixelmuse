/**
 * useGeolocation — Capacitor-aware GPS hook
 * Uses native Capacitor Geolocation on iOS/Android,
 * falls back to Web Geolocation API on browsers.
 * Drop-in replacement for the previous web-only hook.
 */
import { useState, useEffect, useRef } from 'react';
import {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  requestGeoPermissions,
} from '@/utils/capacitor-geolocation';
import { isNativePlatform } from '@/utils/capacitor-platform';

interface GeolocationState {
  coordinates: { lat: number; lng: number } | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  error: string | null;
  isLoading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    accuracy: null,
    speed: null,
    heading: null,
    error: null,
    isLoading: true,
  });

  const watchIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // Request permissions first on native platforms
      if (isNativePlatform()) {
        try {
          const perm = await requestGeoPermissions();
          if (perm.location === 'denied') {
            if (mounted) {
              setState(prev => ({
                ...prev,
                error: 'Location permission denied. Please enable it in Settings.',
                isLoading: false,
              }));
            }
            return;
          }
        } catch {
          // Proceed — permission request may fail in some contexts, still try
        }
      }

      // Get initial position quickly
      try {
        const pos = await getCurrentPosition();
        if (mounted) {
          setState({
            coordinates: { lat: pos.lat, lng: pos.lng },
            accuracy: pos.accuracy,
            speed: pos.speed,
            heading: pos.heading,
            error: null,
            isLoading: false,
          });
        }
      } catch (err: unknown) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Could not get location',
            isLoading: false,
          }));
        }
      }

      // Start continuous watch for live navigation
      try {
        const watchId = await watchPosition(
          (pos) => {
            if (mounted) {
              setState({
                coordinates: { lat: pos.lat, lng: pos.lng },
                accuracy: pos.accuracy,
                speed: pos.speed,
                heading: pos.heading,
                error: null,
                isLoading: false,
              });
            }
          },
          (err) => {
            if (mounted) {
              setState(prev => ({ ...prev, error: err.message }));
            }
          }
        );
        watchIdRef.current = watchId;
      } catch {
        // watchPosition failure is non-fatal; initial position already obtained
      }
    }

    init();

    return () => {
      mounted = false;
      if (watchIdRef.current !== null) {
        clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return state;
}
