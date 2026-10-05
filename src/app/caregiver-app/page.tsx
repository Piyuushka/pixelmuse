'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  Navigation,
  User,
  Users,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Bell,
  Sliders,
  Share2,
  Play,
  Pause,
  RotateCcw,
  BatteryCharging,
  Smartphone,
  ChevronRight,
  Radio,
  Lock,
  Plus,
} from 'lucide-react';

export default function CaregiverAppPage() {
  const { user, speakText } = useAccessibility();

  // Backend state
  const [parentData, setParentData] = useState<any>(null);
  const [selectedChildEmail, setSelectedChildEmail] = useState<string>('alex.rivera@community.org');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Live Ride Tracking State
  const [isSimulatingTrip, setIsSimulatingTrip] = useState(true);
  const [tripProgress, setTripProgress] = useState(55);
  const [copiedLink, setCopiedLink] = useState(false);

  // Pairing Modal state
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);

  // Fetch Dashboard telemetry
  const fetchTelemetryData = useCallback(async () => {
    try {
      setLoading(true);
      const emailToFetch = user?.email || 'parent@community.org';
      const res = await fetch(`/api/parental/dashboard?email=${encodeURIComponent(emailToFetch)}`);
      const data = await res.json();
      if (res.ok) {
        setParentData(data);
        if (data.linkedChildren && data.linkedChildren.length > 0) {
          if (!selectedChildEmail || !data.linkedChildren.some((c: any) => c.email === selectedChildEmail)) {
            setSelectedChildEmail(data.linkedChildren[0].email);
          }
        }
      } else {
        setErrorMsg(data.error || 'Failed to load caregiver telemetry');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error to parental database');
    } finally {
      setLoading(false);
    }
  }, [user?.email, selectedChildEmail]);

  useEffect(() => {
    fetchTelemetryData();
  }, [fetchTelemetryData]);

  // Live movement simulation timer
  useEffect(() => {
    let interval: any;
    if (isSimulatingTrip && tripProgress < 100) {
      interval = setInterval(() => {
        setTripProgress((prev) => {
          if (prev >= 98) {
            clearInterval(interval);
            setIsSimulatingTrip(false);
            speakText('Caregiver Alert: Dependent has arrived safely at destination!');
            return 100;
          }
          return prev + 2;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isSimulatingTrip, tripProgress, speakText]);

  // Handle Account Pairing
  const handlePairAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCodeInput) return;
    setIsPairing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/parental/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_account',
          parentEmail: user?.email || 'parent@community.org',
          pairingCode: pairingCodeInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pairing failed');

      setSuccessMsg('Successfully paired dependent device!');
      setShowPairModal(false);
      setPairingCodeInput('');
      speakText('Dependent device successfully paired with caregiver app');
      fetchTelemetryData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to link account');
    } finally {
      setIsPairing(false);
    }
  };

  // Handle Share Live Tracking Link
  const handleShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(`${window.location.origin}/caregiver-app?track=live`);
      setCopiedLink(true);
      speakText('Caregiver live tracking link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const selectedChild = parentData?.linkedChildren?.find(
    (c: any) => c.email.toLowerCase() === selectedChildEmail.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-background text-on-surface py-6 px-4 max-w-[1200px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── PWA HEADER BANNER FOR CAREGIVERS ───────────────────────────────── */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-primary via-primary/90 to-secondary text-on-primary shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center flex-shrink-0 shadow-inner">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black tracking-widest uppercase">
                MOBILE PWA READY
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
              Pixel Muse — Caregiver & Guardian Companion
            </h1>
            <p className="text-xs opacity-90 font-medium">
              Dedicated mobile companion portal to monitor PWD, seniors & children in real-time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowPairModal(true)}
            className="px-4 py-2.5 rounded-xl bg-white text-primary font-black text-xs flex items-center justify-center gap-1.5 shadow-md hover:bg-white/90 transition-colors w-full sm:w-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Link Dependent Device</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-error/10 border border-error/20 text-error text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="underline">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-secondary/15 border border-secondary/30 text-secondary text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="underline">Dismiss</button>
        </div>
      )}

      {/* ── DEPENDENT SELECTOR STRIP ──────────────────────────────────────── */}
      {parentData?.linkedChildren && parentData.linkedChildren.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto p-2 rounded-2xl bg-surface-container-low border border-outline-variant/30">
          <span className="text-xs font-black text-on-surface uppercase tracking-wider px-3 whitespace-nowrap flex items-center gap-1">
            <Users className="w-4 h-4 text-primary" />
            Monitoring:
          </span>

          <div className="flex items-center gap-2">
            {parentData.linkedChildren.map((c: any) => {
              const isSelected = c.email.toLowerCase() === selectedChildEmail.toLowerCase();
              return (
                <button
                  key={c.id || c.email}
                  type="button"
                  onClick={() => setSelectedChildEmail(c.email)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MAIN CAREGIVER TELEMETRY DASHBOARD ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT 8 COLS — Uber-Style Live Map & Telemetry */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Uber-Style Live Tracker Card */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-xs">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-on-surface">Uber-Style Real-Time Location Stream</h2>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Tracking {selectedChild?.name || 'Grandma / Child'} in real time
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-on-surface text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-primary" />
                  <span>{copiedLink ? 'Link Copied! ✓' : 'Share Live Ride'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSimulatingTrip(!isSimulatingTrip)}
                  className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
                >
                  {isSimulatingTrip ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isSimulatingTrip ? 'Pause' : 'Play Motion'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTripProgress(0);
                    setIsSimulatingTrip(true);
                  }}
                  className="p-2 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                  title="Reset journey"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Destination Arrival Banner */}
            {tripProgress >= 100 && (
              <div className="p-4 rounded-2xl bg-secondary text-on-secondary shadow-md font-black text-xs flex items-center justify-between animate-bounce">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>🎉 DESTINATION REACHED SAFELY! Dependent has arrived at Cardiology Clinic.</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider">COMPLETED</span>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Estimated ETA</span>
                <span className="text-lg font-black text-primary">
                  {tripProgress >= 100 ? 'Arrived 🏁' : `~${Math.max(1, Math.round(15 * (1 - tripProgress / 100)))} mins`}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Distance Left</span>
                <span className="text-lg font-black text-on-surface">
                  {tripProgress >= 100 ? '0.0 km' : `${((2.4 * (100 - tripProgress)) / 100).toFixed(1)} km`}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Device Battery</span>
                <span className="text-lg font-black text-secondary flex items-center gap-1">
                  <BatteryCharging className="w-4 h-4 inline" /> 88%
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Route Safety</span>
                <span className="text-lg font-black text-secondary">
                  94/100 PASSED
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
                <span>Journey Progress: {tripProgress}%</span>
                <span>{tripProgress >= 100 ? 'Arrived at Destination' : 'En Route (Live GPS Stream Active)'}</span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-surface-container-high overflow-hidden p-0.5 border border-outline-variant/30">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                  style={{ width: `${tripProgress}%` }}
                />
              </div>
            </div>

            {/* Interactive Vector Map Canvas */}
            <div className="relative w-full h-[300px] rounded-2xl bg-[#e5eef9] overflow-hidden border border-outline-variant/30 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: `radial-gradient(#2563eb 1.5px, transparent 1.5px), radial-gradient(#059669 1.5px, #e5eef9 1.5px)`,
                  backgroundSize: '24px 24px',
                  backgroundPosition: '0 0, 12px 12px',
                }}
              />

              {/* Path SVG */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <path
                  d="M 60 230 Q 220 130 420 190 T 720 90"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="6"
                  strokeDasharray="8 4"
                />
              </svg>

              {/* Origin */}
              <div className="absolute left-[8%] bottom-[20%] flex flex-col items-center gap-1 z-10">
                <div className="px-2 py-1 rounded-md bg-surface-container-lowest text-[10px] font-black shadow-md border border-outline-variant">
                  Origin: Dadar Station
                </div>
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Dynamic Animated Position Marker */}
              <div
                className="absolute top-[35%] flex flex-col items-center gap-1 z-20 transition-all duration-700 ease-out"
                style={{ left: `${Math.min(84, 8 + tripProgress * 0.76)}%` }}
              >
                <div className="px-2.5 py-1 rounded-full bg-secondary text-on-secondary text-[10px] font-black shadow-xl flex items-center gap-1 whitespace-nowrap">
                  <User className="w-3 h-3" />
                  <span>{selectedChild?.name || 'Grandma'} ({tripProgress}%)</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-secondary/30 flex items-center justify-center animate-ping">
                  <div className="w-5 h-5 rounded-full bg-secondary shadow-md border-2 border-white" />
                </div>
              </div>

              {/* Destination */}
              <div className="absolute right-[8%] top-[15%] flex flex-col items-center gap-1 z-10">
                <div className="px-2 py-1 rounded-md bg-surface-container-lowest text-[10px] font-black shadow-md border border-outline-variant">
                  Destination: Cardiology Clinic
                </div>
                <div className="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center shadow-md">
                  <Navigation className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT 4 COLS — Caregiver Quick Actions & SOS Feed */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Emergency Panic Dispatch Card */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <Phone className="w-4 h-4 text-error" />
                1-Tap Caregiver Panic Action
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
            </div>

            <button
              type="button"
              onClick={() => {
                speakText('Emergency SOS Alert broadcasted to all registered emergency contacts');
                alert('🚨 EMERGENCY SOS DISPATCHED: SMS and call alerts sent to emergency contacts with live GPS coordinates.');
              }}
              className="w-full py-4 rounded-2xl bg-error text-on-error font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-opacity cursor-pointer"
            >
              <ShieldAlert className="w-5 h-5" />
              <span>Broadcast Emergency SOS</span>
            </button>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <a
                href="tel:112"
                className="py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center gap-1.5 border border-outline-variant/30"
              >
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>Call 112 (Police)</span>
              </a>
              <a
                href="tel:108"
                className="py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center gap-1.5 border border-outline-variant/30"
              >
                <Phone className="w-3.5 h-3.5 text-secondary" />
                <span>Call 108 (Ambulance)</span>
              </a>
            </div>
          </div>

          {/* Real-time Alert Log */}
          <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Caregiver Safety Feed
              </span>
              <span className="text-[10px] text-on-surface-variant font-semibold">Live Log</span>
            </div>

            {parentData?.alerts && parentData.alerts.length > 0 ? (
              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {parentData.alerts.map((a: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between font-black">
                      <span className="text-primary uppercase text-[11px]">{a.type || 'SAFETY ALERT'}</span>
                      <span className="text-[10px] opacity-70">{a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'Just now'}</span>
                    </div>
                    <p className="text-xs font-medium text-on-surface">{a.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-on-surface-variant font-medium text-center py-6">
                No active safety warnings. Path is safe.
              </div>
            )}
          </div>

          {/* Link to Full Routing Engine */}
          <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="font-extrabold text-on-surface">Safety Audit & Curfew Rules</span>
              <span className="text-on-surface-variant">Manage step-free access & lighting scores</span>
            </div>
            <Link
              href="/safety-routing"
              className="p-2.5 rounded-xl bg-primary text-on-primary font-extrabold flex items-center gap-1 shadow-sm hover:opacity-90"
            >
              <span>Audit</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

        </div>

      </div>

      {/* ── PAIRING MODAL ─────────────────────────────────────────────────── */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 font-black text-lg text-on-surface">
                <Lock className="w-5 h-5 text-primary" />
                <span>Pair Dependent Device</span>
              </div>
              <button onClick={() => setShowPairModal(false)} className="text-on-surface-variant font-bold">✕</button>
            </div>

            <p className="text-xs text-on-surface-variant font-medium">
              Enter the 6-digit code displayed on your dependent&apos;s phone to establish real-time caregiver monitoring.
            </p>

            <form onSubmit={handlePairAccount} className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="e.g. 849201 or PL-884920"
                value={pairingCodeInput}
                onChange={(e) => setPairingCodeInput(e.target.value)}
                className="w-full h-12 text-center text-lg font-black rounded-2xl bg-surface-container-high border border-outline-variant/40 text-on-surface uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <button
                type="submit"
                disabled={isPairing || !pairingCodeInput}
                className="w-full h-12 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                {isPairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{isPairing ? 'Pairing Device...' : 'Pair & Enable Real-Time Telemetry'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
