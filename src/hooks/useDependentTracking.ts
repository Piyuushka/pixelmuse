'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LocationPing, SOSEvent, BreadcrumbPoint } from '@/lib/locationBroadcaster';

export interface DependentTrackState {
  dependentEmail: string | null;
  dependentName: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery: number | null;
  lastPingAt: string | null;
  isOnline: boolean;
  history: BreadcrumbPoint[];
  activeSOS: SOSEvent | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export function useDependentTracking(dependentEmail?: string | null) {
  const [state, setState] = useState<DependentTrackState>({
    dependentEmail: dependentEmail || null,
    dependentName: null,
    lat: null,
    lng: null,
    accuracy: null,
    speed: null,
    heading: null,
    battery: null,
    lastPingAt: null,
    isOnline: false,
    history: [],
    activeSOS: null,
    connected: false,
    loading: true,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check online status: if no update arrives for 30s, mark dependent offline
  useEffect(() => {
    const timer = setInterval(() => {
      if (state.lastPingAt) {
        const diffMs = Date.now() - new Date(state.lastPingAt).getTime();
        const online = diffMs < 30000; // 30 seconds threshold
        if (online !== state.isOnline) {
          setState(prev => ({ ...prev, isOnline: online }));
        }
      } else {
        if (state.isOnline) {
          setState(prev => ({ ...prev, isOnline: false }));
        }
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [state.lastPingAt, state.isOnline]);

  // Initial and fallback polling function (queries last known location from database)
  const pollLatestLocation = useCallback(async () => {
    if (!dependentEmail) return;
    try {
      const res = await fetch(`/api/location?userId=${encodeURIComponent(dependentEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.currentCoords) {
          const recordedAt = data.lastPingAt || data.updatedAt || null;
          const isFresh = recordedAt ? Date.now() - new Date(recordedAt).getTime() < 30000 : false;
          setState(prev => ({
            ...prev,
            dependentEmail: dependentEmail,
            lat: data.currentCoords.lat,
            lng: data.currentCoords.lng,
            accuracy: data.accuracy ?? prev.accuracy,
            speed: data.speed ?? prev.speed,
            heading: data.heading ?? prev.heading,
            battery: data.battery ?? prev.battery,
            lastPingAt: recordedAt,
            isOnline: isFresh,
            loading: false,
          }));
        }
      }
    } catch {
      // Quiet fallback
    }
  }, [dependentEmail]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!dependentEmail) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    const url = `/api/location/stream?dependentEmail=${encodeURIComponent(dependentEmail)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true, loading: false, error: null }));
    };

    es.addEventListener('location', (evt: MessageEvent) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === 'LOCATION_UPDATE' && payload.data) {
          const loc: LocationPing = payload.data;
          setState(prev => {
            const newHistory = payload.history || [
              ...prev.history,
              { lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp },
            ].slice(-100);

            return {
              ...prev,
              dependentEmail: loc.userEmail || prev.dependentEmail,
              dependentName: loc.name || prev.dependentName,
              lat: loc.lat,
              lng: loc.lng,
              accuracy: loc.accuracy ?? prev.accuracy,
              speed: loc.speed ?? prev.speed,
              heading: loc.heading ?? prev.heading,
              battery: loc.batteryLevel ?? prev.battery,
              lastPingAt: loc.timestamp,
              isOnline: true,
              history: newHistory,
              loading: false,
            };
          });
        }
      } catch (err) {
        console.warn('Error parsing location SSE:', err);
      }
    });

    es.addEventListener('sos', (evt: MessageEvent) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === 'SOS_ALERT' && payload.data) {
          setState(prev => ({ ...prev, activeSOS: payload.data }));
        } else if (payload.type === 'SOS_ACKNOWLEDGED' || payload.type === 'SOS_RESOLVED') {
          if (payload.type === 'SOS_RESOLVED') {
            setState(prev => ({ ...prev, activeSOS: null }));
          } else {
            setState(prev => ({ ...prev, activeSOS: payload.data }));
          }
        }
      } catch (err) {
        console.warn('Error parsing SOS SSE:', err);
      }
    });

    es.addEventListener('guardian', (evt: MessageEvent) => {
      try {
        const event = JSON.parse(evt.data);
        if (event.type === 'SOS_TRIGGER') {
          setState(prev => ({
            ...prev,
            activeSOS: {
              id: event.id,
              userEmail: event.dependentEmail,
              userName: event.dependentName,
              lat: event.payload.coords?.lat || prev.lat || 0,
              lng: event.payload.coords?.lng || prev.lng || 0,
              status: 'TRIGGERED',
              triggeredAt: event.timestamp,
              message: event.message,
            },
          }));
        } else if (event.type === 'LOCATION_UPDATE' && event.payload?.coords) {
          setState(prev => ({
            ...prev,
            lat: event.payload.coords.lat,
            lng: event.payload.coords.lng,
            accuracy: event.payload.accuracy ?? prev.accuracy,
            battery: event.payload.battery ?? prev.battery,
            lastPingAt: event.timestamp,
            isOnline: true,
            loading: false,
          }));
        }
      } catch (err) {
        console.warn('Error parsing guardian SSE:', err);
      }
    });

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false }));
      es.close();

      // Trigger immediate fallback poll and schedule reconnection after 5s
      pollLatestLocation();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [dependentEmail, pollLatestLocation]);

  useEffect(() => {
    // 1. Fetch initial location from server
    pollLatestLocation();

    // 2. Connect live stream
    connect();

    // 3. Keep 5s fallback polling active in case socket drops
    pollIntervalRef.current = setInterval(() => {
      pollLatestLocation();
    }, 5000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [connect, pollLatestLocation]);

  // Acknowledge SOS
  const acknowledgeSOS = useCallback(async () => {
    if (!state.activeSOS) return;
    try {
      await fetch('/api/sos/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sosEventId: state.activeSOS.id,
          dependentEmail: state.activeSOS.userEmail,
        }),
      });
      setState(prev => ({
        ...prev,
        activeSOS: prev.activeSOS ? { ...prev.activeSOS, status: 'ACKNOWLEDGED' } : null,
      }));
    } catch (err) {
      console.error('Failed to acknowledge SOS:', err);
    }
  }, [state.activeSOS]);

  // Resolve SOS
  const resolveSOS = useCallback(async () => {
    if (!state.activeSOS) return;
    try {
      await fetch('/api/sos/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sosEventId: state.activeSOS.id,
          dependentEmail: state.activeSOS.userEmail,
        }),
      });
      setState(prev => ({ ...prev, activeSOS: null }));
    } catch (err) {
      console.error('Failed to resolve SOS:', err);
    }
  }, [state.activeSOS]);

  return {
    ...state,
    acknowledgeSOS,
    resolveSOS,
    reconnect: connect,
  };
}
