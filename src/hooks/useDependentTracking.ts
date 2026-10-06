'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { LocationPing, SOSEvent, BreadcrumbPoint } from '@/lib/locationBroadcaster';

export interface DependentTrackState {
  dependentEmail: string | null;
  dependentName: string | null;
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  battery: number | null;
  lastPingAt: string | null;
  isOnline: boolean;
  history: BreadcrumbPoint[];
  activeSOS: SOSEvent | null;
  connected: boolean;
  error: string | null;
}

export function useDependentTracking(dependentEmail?: string | null) {
  const [state, setState] = useState<DependentTrackState>({
    dependentEmail: dependentEmail || null,
    dependentName: null,
    lat: 18.9398,
    lng: 72.8355,
    accuracy: 5,
    speed: null,
    heading: null,
    battery: 95,
    lastPingAt: null,
    isOnline: false,
    history: [],
    activeSOS: null,
    connected: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check online status (>45 seconds without ping = offline)
  useEffect(() => {
    const timer = setInterval(() => {
      if (state.lastPingAt) {
        const diffMs = Date.now() - new Date(state.lastPingAt).getTime();
        const online = diffMs < 45000;
        if (online !== state.isOnline) {
          setState(prev => ({ ...prev, isOnline: online }));
        }
      } else {
        if (state.isOnline) {
          setState(prev => ({ ...prev, isOnline: false }));
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [state.lastPingAt, state.isOnline]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = dependentEmail
      ? `/api/location/stream?dependentEmail=${encodeURIComponent(dependentEmail)}`
      : '/api/location/stream';

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true, error: null }));
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
              lat: event.payload.coords?.lat || prev.lat,
              lng: event.payload.coords?.lng || prev.lng,
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
            accuracy: event.payload.accuracy || prev.accuracy,
            battery: event.payload.battery || prev.battery,
            lastPingAt: event.timestamp,
            isOnline: true,
          }));
        }
      } catch (err) {
        console.warn('Error parsing guardian SSE:', err);
      }
    });

    es.onerror = () => {
      setState(prev => ({ ...prev, connected: false }));
      es.close();

      // Attempt reconnect after 5s
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [dependentEmail]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

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
