'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Navigation,
  User,
  Users,
  Clock,
  Phone,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Bell,
  Eye,
  Sliders,
  Sparkles,
  Lock,
  ArrowRight,
  Radio,
  SlidersHorizontal,
  Volume2,
  Unlink,
  Check,
  ExternalLink,
  Share2,
  Play,
  Pause,
  RotateCcw,
  BatteryCharging,
  Compass,
} from 'lucide-react';

interface LinkedChild {
  id: string;
  name: string;
  email: string;
  pairingCode: string;
  hasCompletedProfile: boolean;
  accessibilityPreferences: any;
  emergencyContacts: any[];
  privacyConsent: any;
  activeTrip: any;
  tripHistory: any[];
}

export default function ParentDashboardPage() {
  const { user, speakText } = useAccessibility();

  // Selected child state
  const [parentData, setParentData] = useState<any>(null);
  const [selectedChildEmail, setSelectedChildEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Linking modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [inputPairingCode, setInputPairingCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Add Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRel, setContactRel] = useState('Parent / Guardian');

  // Uber-Style Live Ride Tracking simulation state
  const [isSimulatingTrip, setIsSimulatingTrip] = useState(true);
  const [tripProgress, setTripProgress] = useState(42); // percentage 0 to 100
  const [copiedLink, setCopiedLink] = useState(false);
  const [tripReached, setTripReached] = useState(false);

  // Simulation timer effect
  useEffect(() => {
    let interval: any;
    if (isSimulatingTrip && tripProgress < 100) {
      interval = setInterval(() => {
        setTripProgress((prev) => {
          if (prev >= 97) {
            clearInterval(interval);
            setIsSimulatingTrip(false);
            setTripReached(true);
            speakText('Live Tracking Alert: Grandma or Child has arrived safely at destination!');
            return 100;
          }
          return prev + 3;
        });
      }, 1400);
    }
    return () => clearInterval(interval);
  }, [isSimulatingTrip, tripProgress, speakText]);

  // Handle Share Live Trip Link
  const handleShareTrackingLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(`${window.location.origin}/parent-dashboard?track=grandma-live-ride`);
      setCopiedLink(true);
      speakText('Live Uber-style trip tracking link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  // Fetch Dashboard data from backend API
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const emailToFetch = user.email || '';
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
        setErrorMsg(data.error || 'Failed to load parent dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  }, [user.email, selectedChildEmail]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle account linking by 6-digit code
  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPairingCode) return;
    setIsLinking(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/parental/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_account',
          parentEmail: user.email || '',
          pairingCode: inputPairingCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Linking failed');

      setSuccessMsg('Child account linked successfully!');
      setShowLinkModal(false);
      setInputPairingCode('');
      speakText('Account linked successfully to parent guardian dashboard');
      fetchDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to link account');
    } finally {
      setIsLinking(false);
    }
  };

  // Handle unlinking account
  const handleUnlinkAccount = async (childEmail: string) => {
    if (!confirm(`Are you sure you want to unlink child account ${childEmail}?`)) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/parental/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlink_account',
          parentEmail: user.email || '',
          childEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unlink failed');

      setSuccessMsg(`Unlinked ${childEmail} from dashboard.`);
      speakText(`Unlinked child account ${childEmail}`);
      fetchDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unlinking failed');
    }
  };

  // Trigger test real-time alert (SOS or Route Deviation)
  const handleTriggerTestAlert = async (type: 'SOS' | 'ROUTE_DEVIATION' | 'PROLONGED_STOP') => {
    if (!selectedChild) return;
    try {
      const res = await fetch('/api/parental/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childEmail: selectedChild.email,
          alertType: type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Alert trigger failed');

      setSuccessMsg(`Test alert [${type}] dispatched and recorded in database!`);
      speakText(`Alert ${type} recorded for ${selectedChild.name}`);
      fetchDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Alert failed');
    }
  };

  // Add emergency contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone) return;
    try {
      const targetEmail = selectedChild ? selectedChild.email : user.email;
      const res = await fetch('/api/parental/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_emergency_contact',
          email: targetEmail,
          contact: {
            name: contactName,
            phone: contactPhone,
            relationship: contactRel,
            notifyOnSOS: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add contact');

      setSuccessMsg('Emergency contact added to database!');
      setShowContactModal(false);
      setContactName('');
      setContactPhone('');
      fetchDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add contact');
    }
  };

  // Find currently selected child
  const selectedChild: LinkedChild | undefined = parentData?.linkedChildren?.find(
    (c: any) => c.email.toLowerCase() === selectedChildEmail.toLowerCase()
  );

  return (
    <div className="w-full px-4 md:px-8 py-8 flex flex-col items-center">
      <div className="w-full max-w-[1100px] flex flex-col gap-6">

        {/* ─────────────────────────────────────────────────────────────────────
            HEADER & SYSTEM BADGE
        ───────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-md flex-shrink-0">
              <ShieldAlert className="w-7 h-7 text-secondary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
                  Parental Guardian Safety Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary text-xs font-black">
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Real-time route monitoring, emergency SOS alerts, and safety tracking for your linked family members.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDashboardData}
              aria-label="Refresh telemetry"
              className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-primary ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-black text-xs flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Link Child Account</span>
            </button>
          </div>
        </div>

        {/* System Message Banner */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-error/10 text-error border border-error/20 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg('')} className="text-error underline">Dismiss</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-secondary/15 text-secondary border border-secondary/30 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button type="button" onClick={() => setSuccessMsg('')} className="text-secondary underline">Dismiss</button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            LINKED CHILD SELECTOR STRIP
        ───────────────────────────────────────────────────────────────────── */}
        {parentData?.linkedChildren && parentData.linkedChildren.length > 0 ? (
          <div className="flex items-center gap-3 overflow-x-auto p-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            <span className="text-xs font-black text-on-surface uppercase tracking-wider px-3 whitespace-nowrap">
              Linked Navigators ({parentData.linkedChildren.length}):
            </span>

            <div className="flex items-center gap-2 min-w-max">
              {parentData.linkedChildren.map((c: any) => {
                const isSelected = c.email.toLowerCase() === selectedChildEmail.toLowerCase();
                const hasSOS = c.activeTrip?.status === 'SOS_ACTIVE';
                return (
                  <button
                    key={c.id || c.email}
                    type="button"
                    onClick={() => setSelectedChildEmail(c.email)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                    } ${hasSOS ? 'ring-2 ring-error animate-pulse' : ''}`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{c.name}</span>
                    {hasSOS && (
                      <span className="px-1.5 py-0.2 rounded-full bg-error text-on-error text-[10px] font-black">
                        SOS
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant/30 text-center flex flex-col items-center gap-3">
            <Users className="w-10 h-10 text-primary opacity-60" />
            <h2 className="text-lg font-black text-on-surface">No Child Accounts Linked Yet</h2>
            <p className="text-xs text-on-surface-variant font-medium max-w-md">
              Enter the 6-digit pairing code generated on your child&apos;s app to start monitoring live trips and SOS alerts.
            </p>
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-primary text-on-primary text-xs font-black shadow-sm"
            >
              Enter Pairing Code Now
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            MAIN TELEMETRY & ALERTS DASHBOARD GRID
        ───────────────────────────────────────────────────────────────────── */}
        {selectedChild && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT 2 COLS — Live Trip Telemetry & Map */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Uber-Style Live Journey Companion Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/10 via-surface-container-lowest to-surface-container-low border border-primary/30 shadow-md flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md">
                      <Navigation className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-on-surface">Uber-Style Live Journey Tracker</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary text-[10px] font-black uppercase tracking-wider">
                          LIVE STREAM
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Real-time tracking for {selectedChild?.name || 'Grandma / Child'} — monitor live position, route ETA & destination arrival.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShareTrackingLink}
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
                      <span>{isSimulatingTrip ? 'Pause Stream' : 'Play Live Motion'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTripProgress(0);
                        setIsSimulatingTrip(true);
                        setTripReached(false);
                      }}
                      className="p-2 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                      title="Reset ride simulation"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Arrival Alert Banner when 100% reached */}
                {tripProgress >= 100 && (
                  <div className="p-4 rounded-2xl bg-secondary text-on-secondary shadow-lg font-black text-xs flex items-center justify-between animate-bounce">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      <span>🎉 DESTINATION REACHED! {selectedChild?.name || 'Grandma'} arrived safely at target destination.</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-wider opacity-90">ARRIVED SAFELY</span>
                  </div>
                )}

                {/* Telemetry Stats Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
                  <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-0.5">
                    <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Estimated ETA</span>
                    <span className="text-lg font-black text-primary">
                      {tripProgress >= 100 ? 'Arrived 🏁' : `~${Math.max(1, Math.round(18 * (1 - tripProgress / 100)))} mins`}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-0.5">
                    <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Distance Left</span>
                    <span className="text-lg font-black text-on-surface">
                      {tripProgress >= 100 ? '0.0 km' : `${((2.4 * (100 - tripProgress)) / 100).toFixed(1)} km`}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-0.5">
                    <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Device Battery</span>
                    <span className="text-lg font-black text-secondary flex items-center gap-1">
                      <BatteryCharging className="w-4 h-4 inline" /> 88%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-0.5">
                    <span className="text-[10px] font-extrabold text-on-surface-variant uppercase">Safety Score</span>
                    <span className="text-lg font-black text-secondary">
                      94/100 AUDITED
                    </span>
                  </div>
                </div>

                {/* Live Progress Bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
                    <span>Route Progress: {tripProgress}%</span>
                    <span>{tripProgress >= 100 ? 'Arrived at Destination' : 'En Route (Live GPS Stream Active)'}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden p-0.5 border border-outline-variant/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                      style={{ width: `${tripProgress}%` }}
                    />
                  </div>
                </div>

                {/* Quick Simulation Trigger Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/20 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold text-on-surface-variant uppercase">
                      Test Guardian Safety Alerts:
                    </span>

                    <button
                      type="button"
                      onClick={() => handleTriggerTestAlert('SOS')}
                      className="px-2.5 py-1 rounded-lg bg-error text-on-error text-xs font-black hover:opacity-90 cursor-pointer"
                    >
                      🚨 Send SOS
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerTestAlert('ROUTE_DEVIATION')}
                      className="px-2.5 py-1 rounded-lg bg-tertiary text-on-tertiary text-xs font-black hover:opacity-90 cursor-pointer"
                    >
                      ⚠️ Route Deviation
                    </button>
                  </div>

                  <span className="text-[11px] text-on-surface-variant italic">
                    Connected to FastAPI / WebSocket Server
                  </span>
                </div>
              </div>

              {/* Interactive Vector Map Route Preview */}
              <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary" />
                    Live Uber-Style Route Map
                  </span>
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant/30">
                    Live GPS Telemetry ±0.5m
                  </span>
                </div>

                {/* Visual Map Canvas Box */}
                <div className="relative w-full h-[280px] rounded-2xl bg-[#e5eef9] overflow-hidden border border-outline-variant/30 flex items-center justify-center p-4">
                  {/* Grid background */}
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `radial-gradient(#2563eb 1.5px, transparent 1.5px), radial-gradient(#059669 1.5px, #e5eef9 1.5px)`,
                      backgroundSize: '24px 24px',
                      backgroundPosition: '0 0, 12px 12px',
                    }}
                  />

                  {/* Route Line SVG */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d="M 60 220 Q 200 120 400 180 T 700 80"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="6"
                      strokeDasharray="8 4"
                    />
                  </svg>

                  {/* Origin Marker */}
                  <div className="absolute left-[8%] bottom-[20%] flex flex-col items-center gap-1 z-10">
                    <div className="px-2 py-1 rounded-md bg-surface-container-lowest text-[10px] font-black shadow-md border border-outline-variant">
                      Origin: Dadar Station
                    </div>
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Dynamic Child / Grandma Live Position Marker (Animates smoothly along path) */}
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

                  {/* Destination Marker */}
                  <div className="absolute right-[8%] top-[15%] flex flex-col items-center gap-1 z-10">
                    <div className="px-2 py-1 rounded-md bg-surface-container-lowest text-[10px] font-black shadow-md border border-outline-variant">
                      Destination: Cardiology Clinic
                    </div>
                    <div className="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center shadow-md">
                      <Navigation className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Hazard Warning Overlay if alert */}
                  {selectedChild?.activeTrip?.status === 'SOS_ACTIVE' && (
                    <div className="absolute top-4 left-4 right-4 p-3 rounded-2xl bg-error text-on-error font-black text-xs shadow-xl flex items-center justify-between z-30">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 animate-bounce" />
                        <span>EMERGENCY SOS ACTIVE NEAR CONCOURSE</span>
                      </div>
                      <span className="text-[10px] underline">DISPATCHING GUARDIAN</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Trip History Log */}
              <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Completed Trip History ({selectedChild.tripHistory?.length || 0})
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">Recorded in Database</span>
                </div>

                {selectedChild.tripHistory && selectedChild.tripHistory.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {selectedChild.tripHistory.map((trip: any) => (
                      <div
                        key={trip.id}
                        className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-on-surface">
                              {trip.source} → {trip.destination}
                            </span>
                            <span className="text-[11px] text-on-surface-variant font-medium">
                              {new Date(trip.startedAt).toLocaleDateString()} · {trip.distanceMeters}m · {trip.durationMinutes} mins
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface text-[10px] font-bold">
                          {trip.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-on-surface-variant font-medium text-center py-4">
                    No previous trips logged for this child account.
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COL — Alerts Log, Accessibility Inspector & Emergency Contacts */}
            <div className="flex flex-col gap-6">

              {/* Real-time Alert Feed */}
              <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-4 h-4 text-error" />
                    Parent Safety Alert Feed
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
                </div>

                {parentData?.alerts && parentData.alerts.length > 0 ? (
                  <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto">
                    {parentData.alerts.map((alert: any) => (
                      <div
                        key={alert.id}
                        className={`p-3.5 rounded-2xl border text-xs flex flex-col gap-1.5 ${
                          alert.type === 'SOS'
                            ? 'bg-error/10 border-error/30 text-error'
                            : alert.type === 'ROUTE_DEVIATION'
                            ? 'bg-tertiary-container/10 border-tertiary/30 text-on-surface'
                            : 'bg-surface-container-low border-outline-variant/30 text-on-surface'
                        }`}
                      >
                        <div className="flex items-center justify-between font-black">
                          <span className="uppercase text-[11px] tracking-wider">{alert.type}</span>
                          <span className="text-[10px] opacity-75">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs font-medium leading-snug">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-on-surface-variant font-medium text-center py-6">
                    No safety alerts recorded. Navigation is normal.
                  </div>
                )}
              </div>

              {/* Accessibility Profile Inspector */}
              <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    Child Accessibility Profile
                  </span>
                  <span className="text-[10px] font-bold text-secondary">Saved in DB</span>
                </div>

                {selectedChild.accessibilityPreferences ? (
                  <div className="flex flex-col gap-2.5 text-xs font-semibold">
                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
                      <span className="text-on-surface-variant">Primary Persona</span>
                      <strong className="text-primary uppercase font-black">{selectedChild.accessibilityPreferences.primaryPersona}</strong>
                    </div>

                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
                      <span className="text-on-surface-variant">Step-Free Only</span>
                      <strong className="text-on-surface">{selectedChild.accessibilityPreferences.requireStepFree ? 'YES (Guaranteed)' : 'No'}</strong>
                    </div>

                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
                      <span className="text-on-surface-variant">Max Slope Tolerance</span>
                      <strong className="text-on-surface">≤ {selectedChild.accessibilityPreferences.maxSlopePercent}% grade</strong>
                    </div>

                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
                      <span className="text-on-surface-variant">Voice Guidance</span>
                      <strong className="text-on-surface">{selectedChild.accessibilityPreferences.needAudioPrompts ? 'Active' : 'Off'}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-on-surface-variant font-medium">No profile data loaded.</div>
                )}
              </div>

              {/* Emergency Contacts & Unlink Controls */}
              <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    Emergency Contacts & Safety
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    className="p-1.5 rounded-lg bg-primary/10 text-primary text-xs font-extrabold hover:bg-primary/20 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {selectedChild.emergencyContacts && selectedChild.emergencyContacts.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedChild.emergencyContacts.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-extrabold text-on-surface">{c.name}</span>
                          <span className="text-[11px] text-on-surface-variant">{c.phone} · {c.relationship}</span>
                        </div>
                        {c.notifyOnSOS && (
                          <span className="px-2 py-0.5 rounded-full bg-error/15 text-error text-[10px] font-black">
                            SOS Alerted
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-on-surface-variant font-medium text-center py-2">
                    No emergency contacts added yet.
                  </div>
                )}

                {/* Pairing Code & Unlink */}
                <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
                  <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface-variant">Child Pairing Code</span>
                    <strong className="text-primary font-black tracking-widest">{selectedChild.pairingCode}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnlinkAccount(selectedChild.email)}
                    className="w-full py-2.5 rounded-xl bg-error/10 hover:bg-error/20 text-error font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Unlink {selectedChild.name} Account</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          MODAL 1: LINK CHILD ACCOUNT BY 6-DIGIT CODE
      ───────────────────────────────────────────────────────────────────── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 font-black text-lg text-on-surface">
                <Users className="w-5 h-5 text-primary" />
                <span>Link Child Navigator Account</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-on-surface-variant font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-on-surface-variant font-medium">
              Enter the unique 6-digit pairing code displayed on your child&apos;s device to establish secure guardian pairing.
            </p>

            <form onSubmit={handleLinkAccount} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pairing-code-input" className="text-xs font-extrabold text-on-surface">
                  6-Digit Pairing Code (e.g. 849-201)
                </label>
                <input
                  id="pairing-code-input"
                  type="text"
                  placeholder="849-201"
                  value={inputPairingCode}
                  onChange={e => setInputPairingCode(e.target.value)}
                  className="w-full h-12 text-center tracking-widest text-lg font-black rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isLinking}
                className="w-full h-12 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
              >
                <span>{isLinking ? 'Linking Accounts...' : 'Link Account & Enable Telemetry'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          MODAL 2: ADD EMERGENCY CONTACT
      ───────────────────────────────────────────────────────────────────── */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 font-black text-lg text-on-surface">
                <Phone className="w-5 h-5 text-primary" />
                <span>Add Emergency Contact</span>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="text-on-surface-variant font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContact} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-name" className="text-xs font-extrabold text-on-surface">
                  Contact Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  placeholder="Contact full name"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-phone" className="text-xs font-extrabold text-on-surface">
                  Phone Number
                </label>
                <input
                  id="contact-phone"
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="contact-rel" className="text-xs font-extrabold text-on-surface">
                  Relationship
                </label>
                <input
                  id="contact-rel"
                  type="text"
                  placeholder="e.g. Mother / Guardian"
                  value={contactRel}
                  onChange={e => setContactRel(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer mt-2"
              >
                <Check className="w-4 h-4" />
                <span>Save Emergency Contact</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
