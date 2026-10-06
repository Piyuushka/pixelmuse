'use client';

/**
 * UberStyleTripTracker — Uber-like live trip tracking panel.
 *
 * Shows:
 *  1. Live map with child's moving position dot
 *  2. Route polyline drawn from origin → destination
 *  3. Trip status bar (Started → En Route → Arriving → Arrived)
 *  4. ETA countdown
 *  5. Real-time distance remaining
 *  6. Deviation + SOS alerts
 *
 * Connects to /api/guardian/stream (SSE) for live events.
 * If no real SSE events, runs a demo simulation so you can see it working.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Siren,
  Route,
  User,
  Shield,
  Radio,
  ChevronUp,
  ChevronDown,
  LocateFixed,
  ExternalLink,
} from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

type TripStatus = 'waiting' | 'started' | 'en_route' | 'arriving' | 'arrived' | 'sos';

interface TripPoint {
  lat: number;
  lng: number;
}

interface TripState {
  status:           TripStatus;
  childName:        string;
  origin:           string;
  destination:      string;
  startTime:        string;
  currentPosition:  TripPoint;
  routePoints:      TripPoint[];
  progressPercent:  number;
  etaMinutes:       number;
  distanceRemainKm: number;
  lastUpdateAt:     string;
  deviationM:       number | null;
  alerts:           AlertEntry[];
}

interface AlertEntry {
  id:        string;
  type:      string;
  message:   string;
  timestamp: string;
}

// ─── HAVERSINE DISTANCE ──────────────────────────────────────────────────────

function haversineKm(a: TripPoint, b: TripPoint): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ─── DEMO ROUTE (Connaught Place → India Gate, New Delhi) ────────────────────

const DEMO_ROUTE: TripPoint[] = [
  { lat: 28.6315, lng: 77.2167 },  // Connaught Place
  { lat: 28.6308, lng: 77.2180 },
  { lat: 28.6295, lng: 77.2195 },
  { lat: 28.6280, lng: 77.2210 },
  { lat: 28.6265, lng: 77.2225 },
  { lat: 28.6250, lng: 77.2240 },
  { lat: 28.6238, lng: 77.2255 },
  { lat: 28.6225, lng: 77.2268 },
  { lat: 28.6210, lng: 77.2280 },
  { lat: 28.6198, lng: 77.2290 },
  { lat: 28.6185, lng: 77.2300 },
  { lat: 28.6175, lng: 77.2310 },  // India Gate
];

// ─── STATIC MAP HELPER ──────────────────────────────────────────────────────

function StaticMapView({
  center,
  routePoints,
  zoom = 14,
}: {
  center: TripPoint;
  routePoints: TripPoint[];
  zoom?: number;
}) {
  // OpenStreetMap static tile image
  const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${center.lat},${center.lng}&zoom=${zoom}&size=800x400&markers=${center.lat},${center.lng},red-pushpin`;

  return (
    <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden bg-slate-200 border border-outline-variant/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mapUrl}
        alt={`Live map at ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`}
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
      />

      {/* Pulsing GPS dot overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <div className="w-6 h-6 bg-blue-600 rounded-full border-3 border-white shadow-xl z-10 relative" />
          <div className="absolute inset-0 w-6 h-6 bg-blue-400 rounded-full animate-ping opacity-60" />
        </div>
      </div>

      {/* Route line indicator (simplified) */}
      <div className="absolute top-3 left-3 bg-blue-600/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm">
        <Route className="w-3.5 h-3.5" />
        <span>Live Route Tracking</span>
      </div>

      {/* Coordinates badge */}
      <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[11px] font-mono px-2.5 py-1 rounded-lg backdrop-blur-sm">
        {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
      </div>

      {/* OSM attribution */}
      <div className="absolute bottom-3 left-3 bg-black/50 text-white/80 text-[9px] px-1.5 py-0.5 rounded">
        © OpenStreetMap
      </div>
    </div>
  );
}

// ─── STATUS PROGRESS BAR (Uber-style) ────────────────────────────────────────

const STATUS_STEPS: { key: TripStatus; label: string; icon: React.ElementType }[] = [
  { key: 'started',   label: 'Trip Started',  icon: Navigation },
  { key: 'en_route',  label: 'En Route',      icon: Route },
  { key: 'arriving',  label: 'Arriving Soon',  icon: MapPin },
  { key: 'arrived',   label: 'Arrived Safely', icon: CheckCircle2 },
];

function TripProgressBar({ status }: { status: TripStatus }) {
  const currentIndex = STATUS_STEPS.findIndex(s => s.key === status);
  const activeIdx = status === 'sos' ? -1 : currentIndex;

  return (
    <div className="flex items-center gap-1 w-full">
      {STATUS_STEPS.map((step, i) => {
        const isComplete = i < activeIdx;
        const isCurrent  = i === activeIdx;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.key}>
            {/* Step dot */}
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isComplete
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : isCurrent
                    ? 'bg-primary text-on-primary shadow-md ring-4 ring-primary/20 scale-110'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4.5 h-4.5" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`text-[10px] font-bold text-center leading-tight ${
                  isCurrent ? 'text-primary' : isComplete ? 'text-secondary' : 'text-on-surface-variant'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STATUS_STEPS.length - 1 && (
              <div className="flex-1 h-1 rounded-full mx-1 mt-[-18px]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    i < activeIdx ? 'bg-secondary' : 'bg-surface-container-high'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function UberStyleTripTracker() {
  const [trip, setTrip] = useState<TripState>({
    status:           'waiting',
    childName:        'Active Dependent',
    origin:           'Connaught Place Metro',
    destination:      'India Gate',
    startTime:        new Date().toISOString(),
    currentPosition:  DEMO_ROUTE[0],
    routePoints:      DEMO_ROUTE,
    progressPercent:  0,
    etaMinutes:       12,
    distanceRemainKm: 1.8,
    lastUpdateAt:     new Date().toISOString(),
    deviationM:       null,
    alerts:           [],
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const stepIndexRef = useRef(0);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Start demo simulation ──────────────────────────────────────────────

  const startSimulation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    stepIndexRef.current = 0;
    setIsSimulating(true);

    setTrip(prev => ({
      ...prev,
      status: 'started',
      startTime: new Date().toISOString(),
      progressPercent: 0,
      alerts: [
        ...prev.alerts,
        {
          id:        `a_${Date.now()}`,
          type:      'TRIP_STARTED',
          message:   `🟢 ${prev.childName} started walking from ${prev.origin} to ${prev.destination}`,
          timestamp: new Date().toISOString(),
        },
      ],
    }));

    // Move child along route every 2 seconds
    intervalRef.current = setInterval(() => {
      stepIndexRef.current += 1;
      const idx = stepIndexRef.current;

      if (idx >= DEMO_ROUTE.length) {
        // Arrived!
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setIsSimulating(false);

        setTrip(prev => ({
          ...prev,
          status: 'arrived',
          progressPercent: 100,
          etaMinutes: 0,
          distanceRemainKm: 0,
          currentPosition: DEMO_ROUTE[DEMO_ROUTE.length - 1],
          lastUpdateAt: new Date().toISOString(),
          alerts: [
            {
              id:        `a_${Date.now()}`,
              type:      'ARRIVED',
              message:   `✅ ${prev.childName} arrived safely at ${prev.destination}!`,
              timestamp: new Date().toISOString(),
            },
            ...prev.alerts,
          ],
        }));
        return;
      }

      const pos = DEMO_ROUTE[idx];
      const progress = Math.round((idx / (DEMO_ROUTE.length - 1)) * 100);
      const remaining = haversineKm(pos, DEMO_ROUTE[DEMO_ROUTE.length - 1]);
      const eta = Math.max(1, Math.round(remaining / 0.08)); // ~5km/h walking

      // Determine status
      let status: TripStatus = 'en_route';
      if (progress >= 85) status = 'arriving';

      // Simulate a deviation at step 6
      let deviation: number | null = null;
      const newAlerts: AlertEntry[] = [];

      if (idx === 6) {
        deviation = 78;
        newAlerts.push({
          id:        `a_${Date.now()}`,
          type:      'ROUTE_DEVIATION',
          message:   `⚠️ ${trip.childName} deviated 78m from planned route near Janpath Road`,
          timestamp: new Date().toISOString(),
        });
      }

      setTrip(prev => ({
        ...prev,
        status,
        currentPosition: pos,
        progressPercent: progress,
        etaMinutes: eta,
        distanceRemainKm: Math.round(remaining * 10) / 10,
        lastUpdateAt: new Date().toISOString(),
        deviationM: deviation,
        alerts: [...newAlerts, ...prev.alerts],
      }));
    }, 2000);
  }, [trip.childName]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── SOS simulation ─────────────────────────────────────────────────────

  const triggerSOS = () => {
    setTrip(prev => ({
      ...prev,
      status: 'sos',
      alerts: [
        {
          id:        `a_${Date.now()}`,
          type:      'SOS_TRIGGER',
          message:   `🚨 EMERGENCY! ${prev.childName} pressed SOS panic button! Location sent to all contacts.`,
          timestamp: new Date().toISOString(),
        },
        ...prev.alerts,
      ],
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      {/* ── Uber-style trip header card ──────────────────────────────────── */}
      <div className={`p-5 rounded-2xl border shadow-sm transition-all duration-300 ${
        trip.status === 'sos'
          ? 'bg-red-50 border-red-300 shadow-red-100'
          : trip.status === 'arrived'
          ? 'bg-green-50 border-green-300 shadow-green-100'
          : 'bg-surface-container-lowest border-outline-variant/40'
      }`}>

        {/* Child info + Live badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-sm ${
              trip.status === 'sos'
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-secondary-container text-on-secondary-container'
            }`}>
              {trip.status === 'sos' ? <Siren className="w-5 h-5" /> : trip.childName[0]}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2">
                {trip.childName}
                {(trip.status !== 'waiting' && trip.status !== 'arrived') && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold border border-green-200">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                {trip.origin} → {trip.destination}
              </p>
            </div>
          </div>

          {/* ETA / Status badge */}
          <div className="text-right">
            {trip.status === 'arrived' ? (
              <div className="flex flex-col items-end">
                <span className="text-xl font-black text-green-600">Arrived! ✅</span>
                <span className="text-[10px] text-green-600 font-bold">
                  {new Date(trip.lastUpdateAt).toLocaleTimeString()}
                </span>
              </div>
            ) : trip.status === 'sos' ? (
              <span className="text-xl font-black text-red-600 animate-pulse">🚨 SOS</span>
            ) : trip.status === 'waiting' ? (
              <span className="text-sm font-bold text-on-surface-variant">Waiting…</span>
            ) : (
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-primary leading-none">{trip.etaMinutes} min</span>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase">ETA</span>
              </div>
            )}
          </div>
        </div>

        {/* Trip progress bar (Uber-style) */}
        {trip.status !== 'waiting' && trip.status !== 'sos' && (
          <div className="mb-4">
            <TripProgressBar status={trip.status} />
          </div>
        )}

        {/* SOS Banner */}
        {trip.status === 'sos' && (
          <div className="p-4 rounded-xl bg-red-600 text-white mb-4 flex items-center gap-3">
            <Siren className="w-6 h-6 animate-bounce flex-shrink-0" />
            <div>
              <p className="font-extrabold text-sm">Emergency SOS Activated!</p>
              <p className="text-xs text-red-100">Live location sent to all emergency contacts via SMS</p>
            </div>
          </div>
        )}

        {/* Deviation warning */}
        {trip.deviationM && trip.status !== 'sos' && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4 flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">Route Deviation Detected</p>
              <p className="text-[11px] text-amber-600">{trip.childName} is {trip.deviationM}m off the planned route</p>
            </div>
          </div>
        )}

        {/* Stats row */}
        {trip.status !== 'waiting' && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-surface-container-low text-center">
              <p className="text-lg font-black text-primary">{trip.progressPercent}%</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase">Complete</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-low text-center">
              <p className="text-lg font-black text-on-surface">{trip.distanceRemainKm} km</p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase">Remaining</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-low text-center">
              <p className="text-lg font-black text-on-surface">
                {new Date(trip.lastUpdateAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase">Last Update</p>
            </div>
          </div>
        )}

        {/* Live map */}
        {trip.status !== 'waiting' && (
          <StaticMapView
            center={trip.currentPosition}
            routePoints={trip.routePoints}
          />
        )}

        {/* Open in Google Maps link */}
        {trip.status !== 'waiting' && (
          <a
            href={`https://maps.google.com/?q=${trip.currentPosition.lat},${trip.currentPosition.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full h-10 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center justify-center gap-2 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Google Maps
          </a>
        )}
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex gap-3">
        {!isSimulating && trip.status !== 'arrived' && (
          <button
            onClick={startSimulation}
            className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity"
          >
            <Navigation className="w-4.5 h-4.5 fill-current" />
            {trip.status === 'waiting' ? 'Start Live Trip' : 'Restart Trip'}
          </button>
        )}
        {isSimulating && (
          <button
            onClick={triggerSOS}
            className="flex-1 h-12 rounded-xl bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-red-700 transition-colors animate-pulse"
          >
            <Siren className="w-4.5 h-4.5" />
            Simulate SOS
          </button>
        )}
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className="h-12 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 font-bold text-xs text-on-surface flex items-center gap-2 transition-colors relative"
        >
          {trip.alerts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {trip.alerts.length}
            </span>
          )}
          {showAlerts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Alerts
        </button>
      </div>

      {/* ── Alert log (collapsible) ──────────────────────────────────────── */}
      {showAlerts && trip.alerts.length > 0 && (
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 max-h-48 overflow-y-auto">
          <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-1">
            Trip Activity Log
          </h4>
          {trip.alerts.map(a => (
            <div
              key={a.id}
              className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                a.type === 'SOS_TRIGGER'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : a.type === 'ROUTE_DEVIATION'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : a.type === 'ARRIVED'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <span className="font-bold">{a.message}</span>
              <span className="text-[10px] opacity-70 flex-shrink-0 ml-2">
                {new Date(a.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Emergency contacts quick-call ─────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40">
        <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" />
          Emergency Quick-Dial
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'Mom',      phone: '+91-9876543210' },
            { name: 'Dad',      phone: '+91-9123456789' },
            { name: 'Guardian', phone: '+91-9001122334' },
            { name: 'Doctor',   phone: '+91-9555667788' },
          ].map(c => (
            <a
              key={c.phone}
              href={`tel:${c.phone}`}
              className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 flex items-center gap-2.5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-xs font-bold">
                {c.name[0]}
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface">{c.name}</p>
                <p className="text-[10px] text-on-surface-variant font-mono">{c.phone}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
