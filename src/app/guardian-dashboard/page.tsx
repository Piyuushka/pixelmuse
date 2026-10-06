'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  MapPin,
  Navigation,
  User,
  Clock,
  AlertTriangle,
  Radio,
  Bell,
  BellOff,
  Eye,
  Sliders,
  RefreshCw,
  X,
  Siren,
  Wifi,
  WifiOff,
  ChevronRight,
  PhoneCall,
  LocateFixed,
  Route,
} from 'lucide-react';
import { useAccessibility } from '@/context/AccessibilityContext';
import type { GuardianEvent, GuardianLocationPayload } from '@/lib/guardianBroadcaster';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface DependentState {
  email: string;
  name: string;
  linkId: string;
  consentGrantedAt: string | null;
  accessibilityPreferences: Record<string, unknown>;
  activeGuardianTrip: {
    id: string;
    origin: string;
    destination: string;
    status: string;
    startTime: string;
    lastCoords: { lat: number; lng: number } | null;
    lastPingAt: string | null;
    routeGeometry: Array<{ lat: number; lng: number }>;
  } | null;
  emergencyContacts: Array<{ name: string; phone: string; relationship: string }>;
}

interface AlertEntry {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  dependentEmail: string;
  coords?: { lat: number; lng: number };
  read: boolean;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatDuration(startIso: string): string {
  const diff = Date.now() - new Date(startIso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function alertBadgeStyle(type: string): string {
  switch (type) {
    case 'SOS_TRIGGER': return 'bg-red-100 text-red-700 border-red-200';
    case 'ROUTE_DEVIATION': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'PROLONGED_STOP': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'TRIP_STARTED': return 'bg-green-100 text-green-700 border-green-200';
    case 'TRIP_ENDED': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-surface-container text-on-surface border-outline-variant/30';
  }
}

function alertIcon(type: string) {
  switch (type) {
    case 'SOS_TRIGGER': return <Siren className="w-4 h-4 text-red-600" />;
    case 'ROUTE_DEVIATION': return <Route className="w-4 h-4 text-orange-600" />;
    case 'PROLONGED_STOP': return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'TRIP_STARTED': return <Navigation className="w-4 h-4 text-green-600" />;
    default: return <Bell className="w-4 h-4 text-blue-600" />;
  }
}

// ─── LIVE MAP COMPONENT ───────────────────────────────────────────────────────

function LiveMapPanel({
  coords,
  zoom = 15,
}: {
  coords: { lat: number; lng: number } | null;
  zoom?: number;
}) {
  if (!coords) {
    return (
      <div className="w-full h-48 rounded-2xl bg-surface-container flex items-center justify-center border border-outline-variant/30">
        <div className="text-center text-on-surface-variant">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs font-medium">Waiting for GPS signal…</p>
        </div>
      </div>
    );
  }

  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${coordToTile(coords.lat, coords.lng, zoom).x}/${coordToTile(coords.lat, coords.lng, zoom).y}.png`;
  const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=${zoom}&size=600x250&markers=${coords.lat},${coords.lng},red`;

  return (
    <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-outline-variant/30 bg-slate-100">
      {/* OSM Static Map */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=${zoom}&size=600x250&markers=${coords.lat},${coords.lng},red-pushpin`}
        alt={`Live map showing location at ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
        className="w-full h-full object-cover"
        onError={e => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      {/* GPS Dot overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-lg z-10 relative" />
          <div className="absolute inset-0 w-5 h-5 bg-red-400 rounded-full animate-ping opacity-70" />
        </div>
      </div>
      {/* Coords badge */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded-lg backdrop-blur-sm">
        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
      </div>
      {/* OSM attribution */}
      <div className="absolute bottom-2 left-2 bg-black/40 text-white/80 text-[9px] px-1.5 py-0.5 rounded">
        © OpenStreetMap
      </div>
    </div>
  );
}

function coordToTile(lat: number, lng: number, zoom: number) {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}

// ─── SOS MODAL ───────────────────────────────────────────────────────────────

function SOSModal({
  event,
  onDismiss,
}: {
  event: GuardianEvent;
  onDismiss: () => void;
}) {
  const payload = event.payload as any;

  // Play audio cue
  useEffect(() => {
    try {
      const ctx = new AudioContext();
      function beep(t: number, freq: number, dur: number) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square'; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
      }
      // Repeating alarm pattern
      for (let i = 0; i < 3; i++) {
        beep(ctx.currentTime + i * 0.55, 880, 0.2);
        beep(ctx.currentTime + i * 0.55 + 0.25, 660, 0.2);
      }
    } catch { /* no audio context available */ }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.85)',
        animation: 'sos-pulse 1s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes sos-pulse {
          0%, 100% { box-shadow: inset 0 0 0 8px rgba(220,38,38,0.6); }
          50% { box-shadow: inset 0 0 0 8px rgba(220,38,38,0.2); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-4 border-red-600 overflow-hidden"
        style={{ animation: 'shake 0.5s ease-in-out' }}
      >
        {/* Red header */}
        <div className="bg-red-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <Siren className="w-8 h-8 animate-pulse" />
            <h2 className="text-2xl font-black tracking-tight">EMERGENCY SOS</h2>
          </div>
          <p className="text-red-100 text-sm font-semibold">
            {event.dependentName} pressed the panic button
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-800 font-semibold text-sm">{event.message}</p>
            <p className="text-red-500 text-xs mt-1">
              Triggered: {new Date(event.timestamp).toLocaleTimeString()}
            </p>
          </div>

          {payload?.coords && (
            <div className="flex items-center gap-3 bg-surface-container-low rounded-xl p-3">
              <LocateFixed className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-on-surface">Last Known Location</p>
                <p className="text-xs font-mono text-on-surface-variant">
                  {payload.coords.lat?.toFixed(5)}, {payload.coords.lng?.toFixed(5)}
                </p>
                <a
                  href={`https://maps.google.com/?q=${payload.coords.lat},${payload.coords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Open in Google Maps →
                </a>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 w-full py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-colors text-sm"
            >
              <PhoneCall className="w-4 h-4" />
              Call Emergency Services (112)
            </a>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-3 bg-surface-container text-on-surface font-bold rounded-xl hover:bg-surface-container-high transition-colors text-sm border border-outline-variant/40 cursor-pointer"
            >
              Acknowledge & Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ALERT MODAL (for deviation/stop) ────────────────────────────────────────

function AlertModal({
  event,
  onDismiss,
}: {
  event: GuardianEvent;
  onDismiss: () => void;
}) {
  const isDeviation = event.type === 'ROUTE_DEVIATION';
  const payload = event.payload as any;
  const accentColor = isDeviation ? 'orange' : 'yellow';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`bg-white rounded-3xl max-w-sm w-full shadow-2xl border-2 overflow-hidden ${
          isDeviation ? 'border-orange-500' : 'border-yellow-500'
        }`}
      >
        <div className={`px-5 py-4 ${isDeviation ? 'bg-orange-500' : 'bg-yellow-500'} text-white`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            <h3 className="font-black text-lg">
              {isDeviation ? 'Route Deviation' : 'Prolonged Stop'}
            </h3>
          </div>
          <p className="text-sm opacity-90 mt-0.5">{event.dependentName}</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-on-surface font-medium">{event.message}</p>
          {isDeviation && payload?.distanceMeters && (
            <div className="text-xs text-on-surface-variant bg-orange-50 rounded-lg p-3 border border-orange-100">
              {payload.distanceMeters}m off planned route
            </div>
          )}
          {!isDeviation && payload?.stopDurationMs && (
            <div className="text-xs text-on-surface-variant bg-yellow-50 rounded-lg p-3 border border-yellow-100">
              Static for {Math.round(payload.stopDurationMs / 60000)} minutes
            </div>
          )}
          <p className="text-[11px] text-on-surface-variant">
            {new Date(event.timestamp).toLocaleTimeString()}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className={`w-full py-2.5 rounded-xl font-bold text-sm text-white cursor-pointer transition-colors ${
              isDeviation
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
          >
            Acknowledged
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function GuardianDashboardPage() {
  const { user } = useAccessibility();
  const guardianEmail = user.email || '';

  // Dashboard data state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected dependent
  const [selectedDependentEmail, setSelectedDependentEmail] = useState<string>('');
  const selectedDependent: DependentState | null =
    dashboardData?.linkedChildren?.find((c: any) => c.email === selectedDependentEmail) || null;

  // Live telemetry state (updated via SSE)
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveTripStatus, setLiveTripStatus] = useState<string>('');
  const [lastPingTime, setLastPingTime] = useState<string>('');
  const [alertFeed, setAlertFeed] = useState<AlertEntry[]>([]);

  // SSE connection state
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Modal state
  const [sosEvent, setSosEvent] = useState<GuardianEvent | null>(null);
  const [alertModal, setAlertModal] = useState<GuardianEvent | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/parental/dashboard?email=${encodeURIComponent(guardianEmail)}`);
      const data = await res.json();
      if (res.ok) {
        setDashboardData(data);
        if (data.linkedChildren?.length > 0 && !selectedDependentEmail) {
          const first = data.linkedChildren[0];
          setSelectedDependentEmail(first.email);
          if (first.activeGuardianTrip?.lastCoords) {
            setLiveCoords(first.activeGuardianTrip.lastCoords);
          }
        }
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch (e: any) {
      setError(e.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  }, [guardianEmail, selectedDependentEmail]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ─── SSE connection ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!guardianEmail || typeof window === 'undefined') return;

    const url = `/api/guardian/stream?guardianEmail=${encodeURIComponent(guardianEmail)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    const handleEvent = (e: MessageEvent) => {
      try {
        const event: GuardianEvent = JSON.parse(e.data);
        const payload = event.payload as any;

        // Update live coords for the selected dependent
        if (
          payload?.coords &&
          (!selectedDependentEmail || event.dependentEmail === selectedDependentEmail)
        ) {
          setLiveCoords(payload.coords);
          setLastPingTime(event.timestamp);
        }

        // Update trip status
        if (payload?.tripStatus) setLiveTripStatus(payload.tripStatus);

        // Add to alert feed
        const entry: AlertEntry = {
          id: event.id,
          type: event.type,
          message: event.message,
          timestamp: event.timestamp,
          dependentEmail: event.dependentEmail,
          coords: payload?.coords,
          read: false,
        };
        setAlertFeed(prev => [entry, ...prev].slice(0, 50));

        // Show modals for high-priority events
        if (event.type === 'SOS_TRIGGER') {
          setSosEvent(event);
        } else if (event.type === 'ROUTE_DEVIATION' || event.type === 'PROLONGED_STOP') {
          setAlertModal(event);
        }
      } catch { /* parse error */ }
    };

    const eventTypes = [
      'CONNECTED', 'LOCATION_UPDATE', 'ROUTE_DEVIATION',
      'PROLONGED_STOP', 'SOS_TRIGGER', 'TRIP_STARTED', 'TRIP_ENDED',
    ];
    eventTypes.forEach(t => es.addEventListener(t, handleEvent));

    return () => {
      eventTypes.forEach(t => es.removeEventListener(t, handleEvent));
      es.close();
      setSseConnected(false);
    };
  }, [guardianEmail, selectedDependentEmail]);

  // ─── Derived data ────────────────────────────────────────────────────────────

  const activeLinks = dashboardData?.acceptedLinks || [];
  const hasNoDependents = activeLinks.length === 0;

  const displayCoords =
    liveCoords ||
    selectedDependent?.activeGuardianTrip?.lastCoords ||
    null;

  const displayTripStatus =
    liveTripStatus ||
    selectedDependent?.activeGuardianTrip?.status ||
    '';

  const unreadAlerts = alertFeed.filter(a => !a.read).length;

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-on-surface-variant font-medium text-sm">Loading guardian dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SOS Modal — highest priority, persistent */}
      {sosEvent && (
        <SOSModal event={sosEvent} onDismiss={() => setSosEvent(null)} />
      )}

      {/* Alert Modal — deviation / stop */}
      {!sosEvent && alertModal && (
        <AlertModal event={alertModal} onDismiss={() => setAlertModal(null)} />
      )}

      <div className="w-full min-h-screen px-4 md:px-8 py-8 flex flex-col items-center bg-surface">
        <div className="w-full max-w-[1200px] flex flex-col gap-6">

          {/* ─── HEADER ────────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center shadow-md flex-shrink-0">
                <ShieldAlert className="w-7 h-7 text-secondary" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
                    Guardian Dashboard
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary text-xs font-black">
                    LIVE
                  </span>
                  {unreadAlerts > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-black animate-pulse">
                      {unreadAlerts} NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                  Real-time telemetry • Anomaly detection • Emergency alerts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* SSE status */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                sseConnected
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-600 border-red-200'
              }`}>
                {sseConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {sseConnected ? 'Live' : 'Offline'}
              </div>
              <button
                type="button"
                onClick={fetchDashboard}
                className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 transition-colors cursor-pointer"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-on-surface-variant" />
              </button>
              <Link
                href="/guardian-settings"
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5" /> Settings
              </Link>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-error-container rounded-2xl text-on-error-container text-sm font-semibold border border-error/20">
              {error}
            </div>
          )}

          {hasNoDependents ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
              <div className="w-20 h-20 rounded-3xl bg-surface-container flex items-center justify-center">
                <User className="w-10 h-10 text-on-surface-variant/40" />
              </div>
              <div>
                <h2 className="text-xl font-black text-on-surface">No dependents linked yet</h2>
                <p className="text-sm text-on-surface-variant mt-1 max-w-xs">
                  Invite a dependent via Guardian Settings, or ask your dependent to accept your invite.
                </p>
              </div>
              <Link
                href="/guardian-settings"
                className="px-6 py-3 bg-primary text-on-primary rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Open Settings → Invite
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">

              {/* ─── LEFT: Dependent selector + contacts ─────────────────── */}
              <div className="flex flex-col gap-4">

                {/* Dependent selector */}
                <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-5">
                  <h2 className="text-sm font-black text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Monitored Dependents
                  </h2>
                  <div className="flex flex-col gap-2">
                    {dashboardData?.linkedChildren?.map((child: any) => (
                      <button
                        key={child.email}
                        type="button"
                        id={`dependent-selector-${child.email.replace('@', '-')}`}
                        onClick={() => {
                          setSelectedDependentEmail(child.email);
                          if (child.activeGuardianTrip?.lastCoords) {
                            setLiveCoords(child.activeGuardianTrip.lastCoords);
                          }
                        }}
                        className={[
                          'flex items-center gap-3 p-3 rounded-2xl text-left transition-all cursor-pointer border',
                          child.email === selectedDependentEmail
                            ? 'bg-primary/10 border-primary/30 shadow-sm'
                            : 'bg-white/60 border-outline-variant/20 hover:bg-surface-container',
                        ].join(' ')}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">{child.name}</p>
                          <p className="text-[11px] text-on-surface-variant truncate">{child.email}</p>
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          child.activeGuardianTrip?.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-outline-variant'
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emergency contacts */}
                {selectedDependent?.emergencyContacts && selectedDependent.emergencyContacts.length > 0 && (
                  <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-5">
                    <h2 className="text-sm font-black text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                      <PhoneCall className="w-4 h-4" /> Emergency Contacts
                    </h2>
                    <div className="flex flex-col gap-2.5">
                      {selectedDependent.emergencyContacts.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl border border-outline-variant/20">
                          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
                            <PhoneCall className="w-4 h-4 text-secondary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">{c.name}</p>
                            <p className="text-[11px] text-on-surface-variant">{c.relationship}</p>
                          </div>
                          <a
                            href={`tel:${c.phone}`}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            {c.phone}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── RIGHT: Main telemetry panel ─────────────────────────── */}
              <div className="flex flex-col gap-5">

                {selectedDependent ? (
                  <>
                    {/* Live Map */}
                    <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                          <LocateFixed className="w-4 h-4" /> Live Location
                        </h2>
                        {lastPingTime && (
                          <span className="text-[11px] text-on-surface-variant">
                            Updated {formatRelativeTime(lastPingTime)}
                          </span>
                        )}
                      </div>
                      <LiveMapPanel coords={displayCoords} />
                    </div>

                    {/* Trip Info */}
                    {(selectedDependent.activeGuardianTrip || liveTripStatus) && (
                      <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-5">
                        <h2 className="text-sm font-black text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Navigation className="w-4 h-4" /> Active Trip
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <TripInfoCard
                            label="From"
                            value={selectedDependent.activeGuardianTrip?.origin || '—'}
                            icon={<MapPin className="w-4 h-4 text-secondary" />}
                          />
                          <TripInfoCard
                            label="To"
                            value={selectedDependent.activeGuardianTrip?.destination || '—'}
                            icon={<MapPin className="w-4 h-4 text-primary" />}
                          />
                          <TripInfoCard
                            label="Duration"
                            value={
                              selectedDependent.activeGuardianTrip?.startTime
                                ? formatDuration(selectedDependent.activeGuardianTrip.startTime)
                                : '—'
                            }
                            icon={<Clock className="w-4 h-4 text-on-surface-variant" />}
                          />
                          <div className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl border border-outline-variant/20">
                            <Radio className="w-4 h-4 flex-shrink-0 text-on-surface-variant" />
                            <div>
                              <p className="text-[11px] text-on-surface-variant font-semibold">Status</p>
                              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                displayTripStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                displayTripStatus === 'SOS' ? 'bg-red-100 text-red-700 animate-pulse' :
                                'bg-surface-container text-on-surface-variant'
                              }`}>
                                {displayTripStatus || 'UNKNOWN'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Accessibility Preferences (read-only) */}
                    {selectedDependent.accessibilityPreferences && (
                      <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-5">
                        <h2 className="text-sm font-black text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Eye className="w-4 h-4" /> Accessibility Profile (Read-only)
                        </h2>
                        <AccessibilityPrefsView prefs={selectedDependent.accessibilityPreferences} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-10 flex items-center justify-center">
                    <p className="text-on-surface-variant text-sm">Select a dependent to view telemetry</p>
                  </div>
                )}

                {/* Alert Feed */}
                <div className="rounded-3xl bg-surface-container-low border border-outline-variant/20 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                      <Bell className="w-4 h-4" /> Live Alert Feed
                    </h2>
                    {alertFeed.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAlertFeed([])}
                        className="text-[11px] text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {alertFeed.length === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant/50">
                      <BellOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No alerts yet. Monitoring is active.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                      {alertFeed.filter(a => a.type !== 'CONNECTED').map(alert => (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-3 p-3 rounded-2xl border text-xs ${alertBadgeStyle(alert.type)}`}
                        >
                          <div className="flex-shrink-0 mt-0.5">{alertIcon(alert.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold leading-snug">{alert.message}</p>
                            <p className="text-[10px] opacity-60 mt-0.5">
                              {alert.dependentEmail} · {formatRelativeTime(alert.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function TripInfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/60 rounded-2xl border border-outline-variant/20">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-on-surface-variant font-semibold">{label}</p>
        <p className="text-xs font-bold text-on-surface truncate">{value}</p>
      </div>
    </div>
  );
}

function AccessibilityPrefsView({ prefs }: { prefs: Record<string, unknown> }) {
  const boolEntries = Object.entries(prefs).filter(([, v]) => typeof v === 'boolean');
  const otherEntries = Object.entries(prefs).filter(([, v]) => typeof v !== 'boolean');

  function humanize(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }

  return (
    <div className="space-y-3">
      {otherEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {otherEntries.map(([k, v]) => (
            <div key={k} className="p-2.5 bg-white/60 rounded-xl border border-outline-variant/20">
              <p className="text-[10px] text-on-surface-variant font-semibold">{humanize(k)}</p>
              <p className="text-xs font-bold text-on-surface capitalize">{String(v)}</p>
            </div>
          ))}
        </div>
      )}
      {boolEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {boolEntries.filter(([, v]) => v === true).map(([k]) => (
            <span key={k} className="px-2.5 py-1 text-[11px] font-bold bg-secondary/10 text-secondary rounded-full border border-secondary/20">
              ✓ {humanize(k)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Re-export placeholder for missing import
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
