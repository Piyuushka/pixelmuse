'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useDependentTracking } from '@/hooks/useDependentTracking';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Radio,
  Navigation,
  Battery,
  Wifi,
  WifiOff,
  User,
  Clock,
  LocateFixed,
  AlertOctagon,
  CheckCircle,
  RefreshCw,
  Users,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

const LiveMapWrapper = dynamic(() => import('@/components/LiveMapWrapper'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-surface-container-low text-on-surface-variant animate-pulse rounded-3xl font-bold text-sm">
      Loading Live Map...
    </div>
  ),
});

interface DependentListItem {
  id?: string;
  name: string;
  email: string;
  status?: string;
}

export default function CaregiverLiveMapPage() {
  const [selectedDependent, setSelectedDependent] = useState<string>('');
  const [dependentsList, setDependentsList] = useState<DependentListItem[]>([]);
  const [loadingDependents, setLoadingDependents] = useState<boolean>(true);
  const [errorDependents, setErrorDependents] = useState<string | null>(null);

  // Fetch real linked dependents from database API
  const loadDependents = async () => {
    try {
      setLoadingDependents(true);
      setErrorDependents(null);
      const res = await fetch('/api/guardian/dashboard');
      if (res.ok) {
        const data = await res.json();
        const list: DependentListItem[] = data.dependents || [];
        setDependentsList(list);
        if (list.length > 0) {
          if (!selectedDependent || !list.some(d => d.email.toLowerCase() === selectedDependent.toLowerCase())) {
            setSelectedDependent(list[0].email);
          }
        } else {
          setSelectedDependent('');
        }
      } else {
        setErrorDependents('Unable to load linked dependents');
      }
    } catch {
      setErrorDependents('Network error while loading dependents');
    } finally {
      setLoadingDependents(false);
    }
  };

  useEffect(() => {
    loadDependents();
  }, []);

  const {
    dependentName,
    lat,
    lng,
    accuracy,
    speed,
    heading,
    battery,
    lastPingAt,
    isOnline,
    history,
    activeSOS,
    connected,
    loading: trackingLoading,
    acknowledgeSOS,
    resolveSOS,
  } = useDependentTracking(selectedDependent);

  const [followMode, setFollowMode] = useState<boolean>(true);
  const [showTrail, setShowTrail] = useState<boolean>(true);

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return 'Waiting for first GPS ping...';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    return `${m}m ago`;
  };

  // Build GeoJSON route geometry from real breadcrumb history
  const breadcrumbsGeoJson = useMemo(() => {
    if (!showTrail || history.length < 2) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: history.map(p => [p.lng, p.lat]),
          },
          properties: { stroke: '#0284c7', 'stroke-width': 4 },
        },
      ],
    };
  }, [history, showTrail]);

  // Real connection status text
  const realStatusLabel = useMemo(() => {
    if (!connected && !lastPingAt) return 'Connecting...';
    if (!isOnline && lastPingAt) return `Offline · Last seen ${formatLastSeen(lastPingAt)}`;
    if (isOnline && lastPingAt) return `Live location · updated ${formatLastSeen(lastPingAt)}`;
    if (connected && !lastPingAt) return 'Waiting for first GPS ping...';
    return 'Offline';
  }, [connected, isOnline, lastPingAt]);

  const activeDependentItem = useMemo(() => {
    return dependentsList.find(d => d.email.toLowerCase() === selectedDependent.toLowerCase());
  }, [dependentsList, selectedDependent]);

  const activeDisplayName = dependentName || activeDependentItem?.name || selectedDependent;

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 gap-5">
      {/* Real SOS Alert Banner if active */}
      {activeSOS && (
        <div className={`p-4 md:p-5 rounded-3xl border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse ${
          activeSOS.status === 'TRIGGERED'
            ? 'bg-error/15 border-error text-error'
            : 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-error text-on-error flex items-center justify-center font-black flex-shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase tracking-wider">
                {activeSOS.status === 'TRIGGERED' ? 'EMERGENCY SOS ALERT' : 'SOS ACKNOWLEDGED'}
              </span>
              <span className="text-xs font-semibold">
                {activeSOS.userName || activeDisplayName} triggered distress at {new Date(activeSOS.triggeredAt).toLocaleTimeString()}
              </span>
              {activeSOS.message && (
                <span className="text-[11px] opacity-80 mt-0.5">{activeSOS.message}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSOS.status === 'TRIGGERED' && (
              <button
                type="button"
                onClick={acknowledgeSOS}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white font-extrabold text-xs cursor-pointer hover:bg-amber-600 transition-colors"
              >
                Acknowledge
              </button>
            )}
            <button
              type="button"
              onClick={resolveSOS}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Mark Resolved</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Telemetry Header Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-4 md:p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left: Dependent Profile Info */}
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-black text-lg shadow-md flex-shrink-0">
            {activeDisplayName ? activeDisplayName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-on-surface">
                {activeDisplayName || 'No Dependent Selected'}
              </span>
              {selectedDependent && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase ${
                  isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span>{selectedDependent || 'No active account'}</span>
              <span>•</span>
              <span className="font-bold text-primary flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatLastSeen(lastPingAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Dependent Switcher & Map Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {dependentsList.length > 0 && (
            <select
              value={selectedDependent}
              onChange={(e) => setSelectedDependent(e.target.value)}
              aria-label="Select dependent"
              className="h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {dependentsList.map(d => (
                <option key={d.email} value={d.email}>
                  {d.name} ({d.email})
                </option>
              ))}
            </select>
          )}

          {/* With "No Dependent Selected", hide the Following, Trail On and Manage buttons */}
          {Boolean(selectedDependent && dependentsList.length > 0) && (
            <>
              {/* Follow Toggle */}
              <button
                type="button"
                onClick={() => setFollowMode(!followMode)}
                className={`h-10 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  followMode
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
                }`}
              >
                <LocateFixed className="w-4 h-4" />
                <span>{followMode ? 'Following' : 'Free Pan'}</span>
              </button>

              {/* Breadcrumb trail toggle */}
              <button
                type="button"
                onClick={() => setShowTrail(!showTrail)}
                className={`h-10 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  showTrail
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>{showTrail ? 'Trail On' : 'Trail Off'}</span>
              </button>

              <Link
                href="/caregiver/dependents"
                className="h-10 px-3.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Manage</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main Content: Empty State when no dependents linked yet */}
      {!loadingDependents && dependentsList.length === 0 ? (
        <div className="flex-1 w-full min-h-[480px] rounded-3xl bg-surface-container-lowest border border-outline-variant/30 text-center flex flex-col items-center justify-center p-8 md:p-16 gap-5 shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-secondary/15 text-secondary flex items-center justify-center font-black shadow-inner">
            <Users className="w-10 h-10" />
          </div>
          <div className="flex flex-col items-center gap-2 max-w-md">
            <h2 className="text-2xl font-black text-on-surface">No dependents linked yet</h2>
            <p className="text-xs sm:text-sm text-on-surface-variant font-medium leading-relaxed">
              Add one with a pairing code to begin monitoring live coordinates, battery levels, and safety status.
            </p>
          </div>
          <Link
            href="/caregiver/dependents"
            className="mt-2 px-6 py-3.5 rounded-2xl bg-primary text-on-primary text-xs sm:text-sm font-black shadow-md hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer"
          >
            <span>Add Dependent With Pairing Code</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Telemetry Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Battery */}
            <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Battery className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-on-surface-variant uppercase">Device Battery</span>
                <span className="text-sm font-extrabold text-on-surface">
                  {battery !== null && battery !== undefined ? `${battery}%` : '—'}
                </span>
              </div>
            </div>

            {/* GPS Accuracy */}
            <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
                <LocateFixed className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-on-surface-variant uppercase">GPS Precision</span>
                <span className="text-sm font-extrabold text-on-surface">
                  {accuracy !== null && accuracy !== undefined && lastPingAt ? `±${accuracy.toFixed(1)}m` : '—'}
                </span>
              </div>
            </div>

            {/* Speed */}
            <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Navigation className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-on-surface-variant uppercase">Movement Speed</span>
                <span className="text-sm font-extrabold text-on-surface">
                  {speed !== null && speed !== undefined && lastPingAt
                    ? `${(speed * 3.6).toFixed(1)} km/h`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Connection Status */}
            <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Radio className={`w-5 h-5 ${connected ? 'animate-pulse' : ''}`} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-on-surface-variant uppercase">Connection</span>
                <span className="text-xs font-extrabold text-on-surface truncate">
                  {realStatusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Main Map Visualizer */}
          <div className="flex-1 w-full min-h-[520px] rounded-3xl overflow-hidden border border-outline-variant/30 shadow-xl relative bg-surface-container-lowest">
            <LiveMapWrapper
              center={{
                lat: lat ?? 18.9322,
                lng: lng ?? 72.8264,
              }}
              zoom={lat && lng ? 17 : 14}
              accuracy={accuracy ?? 0}
              routeGeojson={breadcrumbsGeoJson}
              roadName={realStatusLabel}
              isNavigating={false}
            />

            {/* Floating Map Status Overlay (Bottom Left) */}
            {lat && lng ? (
              <div className="absolute bottom-4 left-4 z-30 p-3.5 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/30 shadow-lg flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-on-surface">
                    Coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">
                    Breadcrumbs: {history.length} points logged
                  </span>
                </div>
              </div>
            ) : (
              <div className="absolute bottom-4 left-4 z-30 p-3.5 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/30 shadow-lg flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-on-surface">
                    Awaiting GPS Broadcast
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">
                    Live location packet has not arrived yet
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
