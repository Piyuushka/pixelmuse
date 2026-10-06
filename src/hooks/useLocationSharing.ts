'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Preset simulated walking route in Mumbai (Marine Drive / Churchgate / Fort)
export const SIMULATED_WALK_ROUTE = [
  { lat: 18.9322, lng: 72.8264, name: 'Marine Drive Promenade (Starting Point)' },
  { lat: 18.9328, lng: 72.8271, name: 'Marine Drive - Crossroad 1' },
  { lat: 18.9335, lng: 72.8280, name: 'Veer Nariman Road Corner' },
  { lat: 18.9341, lng: 72.8290, name: 'Churchgate Station West Entrance' },
  { lat: 18.9348, lng: 72.8302, name: 'Churchgate Sub-way Crossing' },
  { lat: 18.9355, lng: 72.8315, name: 'Maharshi Karve Road' },
  { lat: 18.9363, lng: 72.8328, name: 'Flora Fountain Plaza Approach' },
  { lat: 18.9372, lng: 72.8340, name: 'Flora Fountain Heritage Circle' },
  { lat: 18.9381, lng: 72.8348, name: 'MG Road Footpath' },
  { lat: 18.9390, lng: 72.8354, name: 'Fort Business District' },
  { lat: 18.9398, lng: 72.8355, name: 'Chhatrapati Shivaji Maharaj Terminus Plaza' },
];

export interface LocationState {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  battery: number;
  isSharing: boolean;
  isSimulating: boolean;
  lastPingAt: string | null;
  error: string | null;
}

export function useLocationSharing(enabled: boolean = true) {
  const [location, setLocation] = useState<LocationState>({
    lat: 18.9322,
    lng: 72.8264,
    accuracy: 5,
    speed: null,
    heading: null,
    battery: 95,
    isSharing: enabled,
    isSimulating: false,
    lastPingAt: null,
    error: null,
  });

  const simulationIndexRef = useRef(0);
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const batteryLevelRef = useRef<number>(95);

  // Monitor Battery API if available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        batteryLevelRef.current = Math.round(battery.level * 100);
        battery.addEventListener('levelchange', () => {
          batteryLevelRef.current = Math.round(battery.level * 100);
        });
      }).catch(() => {});
    }
  }, []);

  // Ping API function
  const sendPing = useCallback(async (coords: { lat: number; lng: number; accuracy?: number; speed?: number | null; heading?: number | null }) => {
    try {
      const payload = {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy ?? 5,
        speed: coords.speed ?? 0,
        heading: coords.heading ?? 0,
        battery: batteryLevelRef.current,
      };

      const res = await fetch('/api/location/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const now = new Date().toISOString();
        setLocation(prev => ({
          ...prev,
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy ?? prev.accuracy,
          speed: coords.speed ?? prev.speed,
          heading: coords.heading ?? prev.heading,
          battery: batteryLevelRef.current,
          lastPingAt: now,
          error: null,
        }));
      }
    } catch (err: any) {
      console.warn('Failed to send location ping:', err);
    }
  }, []);

  // Real GPS Geolocation Watcher
  useEffect(() => {
    if (!enabled || location.isSimulating) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      // Immediate initial position
      navigator.geolocation.getCurrentPosition(
        pos => {
          sendPing({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          });
        },
        err => {
          console.warn('Geolocation initial error:', err.message);
          setLocation(prev => ({ ...prev, error: err.message }));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );

      // Continuous watcher
      const watchId = navigator.geolocation.watchPosition(
        pos => {
          sendPing({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          });
        },
        err => {
          console.warn('Geolocation watch error:', err.message);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );

      watchIdRef.current = watchId;

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    }
  }, [enabled, location.isSimulating, sendPing]);

  // Toggle Simulated Movement (Mumbai Route)
  const toggleSimulation = useCallback(() => {
    setLocation(prev => {
      const nextSimState = !prev.isSimulating;
      return { ...prev, isSimulating: nextSimState };
    });
  }, []);

  // Simulation Loop
  useEffect(() => {
    if (location.isSimulating) {
      // Send first simulation point immediately
      const pt = SIMULATED_WALK_ROUTE[simulationIndexRef.current % SIMULATED_WALK_ROUTE.length];
      sendPing({ lat: pt.lat, lng: pt.lng, accuracy: 2, speed: 1.4, heading: 45 });

      simulationTimerRef.current = setInterval(() => {
        simulationIndexRef.current = (simulationIndexRef.current + 1) % SIMULATED_WALK_ROUTE.length;
        const currentPt = SIMULATED_WALK_ROUTE[simulationIndexRef.current];
        sendPing({ lat: currentPt.lat, lng: currentPt.lng, accuracy: 2, speed: 1.4, heading: 45 });
      }, 3000);
    } else {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    }

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [location.isSimulating, sendPing]);

  const toggleSharing = useCallback(() => {
    setLocation(prev => ({ ...prev, isSharing: !prev.isSharing }));
  }, []);

  return {
    ...location,
    toggleSimulation,
    toggleSharing,
    sendManualPing: sendPing,
  };
}
