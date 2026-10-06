'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useDependentTracking } from '@/hooks/useDependentTracking';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Radio,
  Navigation,
  Compass,
  BatteryCharging,
  Battery,
  Wifi,
  WifiOff,
  User,
  Clock,
  LocateFixed,
  AlertOctagon,
  CheckCircle,
  PhoneCall,
  Activity,
  Layers,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

const LiveMapWrapper = dynamic(() => import('@/components/LiveMapWrapper'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-surface-container-low text-on-surface-variant animate-pulse rounded-3xl">
      Initializing Real-Time Dependent Tracking Engine...
    </div>
  ),
});

export default function CaregiverLiveMapPage() {
  const [selectedDependent, setSelectedDependent] = useState<string>('demo.user@pathfinder.app');
  const [dependentsList, setDependentsList] = useState<Array<{ name: string; email: string; status: string }>>([
    { name: 'Demo User', email: 'demo.user@pathfinder.app', status: 'ONLINE' },
    { name: 'Alex Rivera', email: 'alex.rivera@community.org', status: 'ONLINE' },
  ]);

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
    acknowledgeSOS,
    resolveSOS,
  } = useDependentTracking(selectedDependent);

  const [followMode, setFollowMode] = useState<boolean>(true);
  const [showTrail, setShowTrail] = useState<boolean>(true);

  // Fetch linked dependents from server
  useEffect(() => {
    async function loadDependents() {
      try {
        const res = await fetch('/api/guardian/dashboard');
        const data = await res.json();
        if (res.ok && data.dependents && data.dependents.length > 0) {
          setDependentsList(data.dependents);
          if (!selectedDependent) {
            setSelectedDependent(data.dependents[0].email);
          }
        }
      } catch (err) {
        console.warn('Could not fetch guardian dashboard dependents:', err);
      }
    }
    loadDependents();
  }, [selectedDependent]);

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return 'Waiting for first GPS ping...';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 5) return 'Just now (Live)';
    if (diff < 60) return `${diff} seconds ago`;
    const m = Math.floor(diff / 60);
    return `${m} minute${m > 1 ? 's' : ''} ago`;
  };

  // Build GeoJSON route geometry from breadcrumbs for visualizer
  const breadcrumbsGeoJson = React.useMemo(() => {
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

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 gap-5">
      {/* Top Telemetry Header Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-4 md:p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left: Dependent Profile Info & Dropdown */}
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-black text-lg shadow-md flex-shrink-0">
            {dependentName ? dependentName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-on-surface">
                {dependentName || (selectedDependent === 'demo.user@pathfinder.app' ? 'Demo User (Dependent)' : selectedDependent)}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase ${
                isOnline ? 'bg-emerald-500/15 text-emerald-600' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'Live Tracking' : 'Offline / Idle'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span>{selectedDependent}</span>
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
          {/* Dependent Select Dropdown */}
          <select
            value={selectedDependent}
            onChange={(e) => setSelectedDependent(e.target.value)}
            className="h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            {dependentsList.map(d => (
              <option key={d.email} value={d.email}>
                {d.name} ({d.email})
              </option>
            ))}
          </select>

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
        </div>
      </div>

      {/* Telemetry Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Battery */}
        <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Battery className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-on-surface-variant uppercase">Device Battery</span>
            <span className="text-sm font-extrabold text-on-surface">{battery !== null ? `${battery}%` : '95%'}</span>
          </div>
        </div>

        {/* GPS Accuracy */}
        <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">
            <LocateFixed className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-on-surface-variant uppercase">GPS Precision</span>
            <span className="text-sm font-extrabold text-on-surface">±{accuracy.toFixed(1)}m</span>
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
              {speed !== null && speed > 0 ? `${(speed * 3.6).toFixed(1)} km/h` : '1.4 km/h (Walking)'}
            </span>
          </div>
        </div>

        {/* Stream Status */}
        <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-on-surface-variant uppercase">SSE Telemetry</span>
            <span className="text-sm font-extrabold text-on-surface">{connected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>
      </div>

      {/* Main Map Visualizer */}
      <div className="flex-1 w-full min-h-[520px] rounded-3xl overflow-hidden border border-outline-variant/30 shadow-xl relative bg-surface-container-lowest">
        <LiveMapWrapper
          center={{ lat, lng }}
          destination={{ lat: 18.9322, lng: 72.8264 }}
          destName="Marine Drive Concourse"
          roadName="Live Caregiver Guardian Stream"
          accuracy={accuracy}
          routeGeojson={breadcrumbsGeoJson}
          zoom={17}
        />

        {/* Floating Map Status Overlay (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-30 p-3.5 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/30 shadow-lg flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-on-surface">
              Live Coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium">
              Breadcrumbs logged: {history.length} points
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
