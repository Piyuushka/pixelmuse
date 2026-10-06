'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import { DependentMapMarker } from '@/components/DependentMapMarker';
import { HistorySlider } from '@/components/HistorySlider';
import type { LocationPing } from '@/lib/locationCache';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Lock,
  Plus,
  Radio,
  Clock,
  Battery,
  AlertTriangle,
  Siren,
  Bell,
  RefreshCw,
  SlidersHorizontal,
  Navigation,
  CheckCircle2,
  MapPin,
} from 'lucide-react';

interface DependentData {
  id: string;
  name: string;
  email: string;
  pairingCode: string;
  activeTrip: any;
}

export default function CaregiverDashboardPage() {
  const { speakText } = useAccessibility();

  const [dependents, setDependents] = useState<DependentData[]>([]);
  const [selectedDependentEmail, setSelectedDependentEmail] = useState<string>('');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);

  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [historyPings, setHistoryPings] = useState<LocationPing[]>([]);
  const [selectedHistoryPing, setSelectedHistoryPing] = useState<LocationPing | null>(null);
  const [activeSosEvent, setActiveSosEvent] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch linked dependents
  const fetchLinks = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/pairing/links');
      const data = await res.json();
      if (res.ok && data.success) {
        setDependents(data.dependents || []);
        if (data.dependents && data.dependents.length > 0) {
          const firstEmail = data.dependents[0].email;
          setSelectedDependentEmail(firstEmail);
          if (data.dependents[0].activeTrip?.currentCoords) {
            setCurrentCoords(data.dependents[0].activeTrip.currentCoords);
          } else {
            // Default Mumbai coords if no active trip
            setCurrentCoords({ lat: 19.0760, lng: 72.8777 });
          }
        } else {
          // Demo fallback coords
          setCurrentCoords({ lat: 19.0760, lng: 72.8777 });
        }
      }
    } catch (err) {
      console.error('Failed to load caregiver links:', err);
      setCurrentCoords({ lat: 19.0760, lng: 72.8777 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Fetch 24h location history when selected dependent changes
  useEffect(() => {
    if (!selectedDependentEmail) return;
    async function loadHistory() {
      try {
        const res = await fetch(`/api/location/history?dependentEmail=${encodeURIComponent(selectedDependentEmail)}`);
        const data = await res.json();
        if (res.ok && data.success && data.history) {
          setHistoryPings(data.history);
        }
      } catch (err) {
        console.error('Failed to load location history:', err);
      }
    }
    loadHistory();
  }, [selectedDependentEmail]);

  // Connect SSE real-time stream
  useEffect(() => {
    const es = new EventSource('/api/guardian/stream');

    es.onopen = () => {
      setSseConnected(true);
    };

    es.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data);

        if (event.type === 'LOCATION_UPDATE') {
          const payload = event.payload;
          if (payload.coords) {
            setCurrentCoords(payload.coords);
          }
          if (typeof payload.battery === 'number') setBattery(payload.battery);
          if (typeof payload.accuracy === 'number') setAccuracy(payload.accuracy);
          if (typeof payload.speed === 'number') setSpeed(payload.speed);
        } else if (event.type === 'SOS_TRIGGER') {
          setActiveSosEvent(event);
          speakText(`EMERGENCY SOS ALERT from ${event.dependentName || 'dependent'}`);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
    };
  }, [speakText]);

  const activeDependent = dependents.find((d) => d.email.toLowerCase() === selectedDependentEmail.toLowerCase());
  const activeCoords = selectedHistoryPing ? { lat: selectedHistoryPing.lat, lng: selectedHistoryPing.lng } : currentCoords;

  return (
    <div className="min-h-screen bg-surface text-on-surface p-6">
      {/* SOS Alert Modal Banner */}
      {activeSosEvent && (
        <div className="fixed inset-0 z-50 bg-red-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-red-900 border-2 border-red-500 rounded-3xl p-6 text-white shadow-2xl space-y-4 animate-bounce">
            <div className="flex items-center gap-3">
              <Siren className="w-8 h-8 text-red-300 animate-pulse" />
              <div>
                <h2 className="text-xl font-black">EMERGENCY SOS TRIGGERED</h2>
                <p className="text-xs text-red-200">Immediate Caregiver Action Required</p>
              </div>
            </div>
            <p className="text-sm font-bold bg-red-950/60 p-3 rounded-xl border border-red-700/50">
              {activeSosEvent.message || 'Emergency Panic Button Pressed!'}
            </p>
            <div className="flex items-center justify-between text-xs font-semibold text-red-200 pt-2 border-t border-red-700">
              <span>National Emergency: 112</span>
              <button
                type="button"
                onClick={() => setActiveSosEvent(null)}
                className="px-4 py-2 bg-white text-red-900 font-black rounded-xl hover:bg-red-100"
              >
                Acknowledge & Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/40 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-on-surface tracking-tight">Caregiver Safety Dashboard</h1>
              <p className="text-xs text-on-surface-variant font-medium flex items-center gap-2">
                <span>Real-time GPS Tracking & Geofence Safety Engine</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sseConnected ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}>
                  <Radio className={`w-3 h-3 ${sseConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
                  {sseConnected ? 'SSE Live Stream Active' : 'Connecting Stream...'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/caregiver-pairing"
              className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" /> Pair New Dependent
            </Link>
          </div>
        </div>

        {/* Dependent Filter Chips */}
        {dependents.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Track Dependent:</span>
            {dependents.map((dep) => {
              const isSelected = dep.email.toLowerCase() === selectedDependentEmail.toLowerCase();
              return (
                <button
                  key={dep.id || dep.email}
                  type="button"
                  onClick={() => setSelectedDependentEmail(dep.email)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm ring-2 ring-primary'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant/30'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{dep.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Grid: Live Tracking Map & Stats Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Map Column (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="relative w-full h-[450px] rounded-3xl overflow-hidden border border-outline-variant/40 bg-slate-900 shadow-2xl flex items-center justify-center">
              {/* Dynamic Map Tile Background */}
              {activeCoords && (
                <iframe
                  title="Live Tracking Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeCoords.lng - 0.008},${activeCoords.lat - 0.008},${activeCoords.lng + 0.008},${activeCoords.lat + 0.008}&layer=mapnik&marker=${activeCoords.lat},${activeCoords.lng}`}
                  className="w-full h-full opacity-90 filter contrast-105"
                />
              )}

              {/* Marker Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <DependentMapMarker
                  name={activeDependent?.name || 'Dependent'}
                  battery={battery ?? 0}
                  accuracy={accuracy ?? 0}
                  isSosActive={!!activeSosEvent}
                />
              </div>

              {/* Real-time Telemetry Floating Badge */}
              <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-700/60 rounded-2xl p-3 text-white backdrop-blur-md shadow-lg space-y-1">
                <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-400">
                  <Navigation className="w-4 h-4" />
                  <span>{activeDependent?.name || 'Live Navigation'}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1 font-semibold">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" /> {battery !== null ? `${battery}%` : '—'}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span>Accuracy: {accuracy !== null ? `±${accuracy}m` : '—'}</span>
                  <span className="text-slate-500">•</span>
                  <span>Speed: {speed !== null ? `${speed} km/h` : '—'}</span>
                </div>
              </div>

              {/* 24h Playback Slider Overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <HistorySlider pings={historyPings} onSelectPing={(ping) => setSelectedHistoryPing(ping)} />
              </div>
            </div>
          </div>

          {/* Telemetry & Controls Column (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Trip Status Card */}
            <div className="p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-primary" /> Active Trip Telemetry
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-extrabold text-[10px] border border-emerald-500/20">
                  MONITORING
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Current Location</span>
                  <p className="font-bold text-on-surface flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {activeCoords ? `${activeCoords.lat.toFixed(5)}, ${activeCoords.lng.toFixed(5)}` : 'Scanning...'}
                  </p>
                </div>

                <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Destination</span>
                  <p className="font-semibold text-on-surface">
                    {activeDependent?.activeTrip?.destination || 'Active Navigation Route'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">Battery</span>
                    <p className="font-bold text-emerald-600 text-sm">{battery !== null ? `${battery}%` : '—'}</p>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">GPS Precision</span>
                    <p className="font-bold text-primary text-sm">{accuracy !== null ? `±${accuracy}m` : '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Safety Actions Card */}
            <div className="p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" /> Safety Tools & Controls
              </h3>
              <div className="space-y-2">
                <Link
                  href="/user-profile"
                  className="w-full p-3 rounded-2xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center justify-between"
                >
                  <span>Manage Linkage & Pairing Codes</span>
                  <Lock className="w-4 h-4 text-primary" />
                </Link>
                <button
                  type="button"
                  onClick={() => fetchLinks()}
                  className="w-full p-3 rounded-2xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center justify-between"
                >
                  <span>Force Refresh Telemetry</span>
                  <RefreshCw className="w-4 h-4 text-primary" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
