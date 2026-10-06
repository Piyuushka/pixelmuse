'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccessibility, PersonaType } from '@/context/AccessibilityContext';
import {
  ShieldCheck,
  ShieldAlert,
  Sun,
  Moon,
  Lightbulb,
  TrafficCone,
  Footprints,
  MoveUpRight,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Accessibility,
  Heart,
  Navigation,
  Users,
  Plus,
  Unlink,
  RefreshCw,
  Bell,
  SlidersHorizontal,
  Sparkles,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import {
  DEMO_ROUTES,
  rankRoutesForPersona,
  getSafetyLabel,
  RouteWithSafety,
  SegmentSafetyProfile,
  SafetyLabel,
} from '@/lib/safetyRoutingEngine';

// ─────────────────────────────────────────────────────────────────────────────
// COLOR & RATING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_COLORS: Record<SafetyLabel, { bg: string; text: string; border: string; ring: string }> = {
  safe:     { bg: 'bg-secondary/10',  text: 'text-secondary',  border: 'border-secondary/40',  ring: 'ring-secondary/20' },
  moderate: { bg: 'bg-primary/10',    text: 'text-primary',    border: 'border-primary/40',    ring: 'ring-primary/20' },
  caution:  { bg: 'bg-tertiary/10',   text: 'text-tertiary',   border: 'border-tertiary/40',   ring: 'ring-tertiary/20' },
};

const SCORE_BADGE: Record<SafetyLabel, string> = {
  safe:     'bg-secondary text-on-secondary',
  moderate: 'bg-primary text-on-primary',
  caution:  'bg-tertiary text-on-tertiary',
};

const SCORE_BAR: Record<SafetyLabel, string> = {
  safe:     'bg-secondary',
  moderate: 'bg-primary',
  caution:  'bg-tertiary',
};

function ScoreBar({ value, max = 20, label }: { value: number; max?: number; label: SafetyLabel }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${SCORE_BAR[label]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const PERSONA_META: Record<PersonaType, { label: string; emoji: string; icon: React.ElementType }> = {
  wheelchair:    { label: 'Wheelchair',  emoji: '♿', icon: Accessibility },
  'low-vision':  { label: 'Low Vision',  emoji: '👁️', icon: Eye },
  'older-adult': { label: 'Older Adult', emoji: '🧓', icon: Footprints },
  caregiver:     { label: 'Caregiver',   emoji: '🤝', icon: Heart },
  none:          { label: 'Standard',    emoji: '🧭', icon: Navigation },
};

const SUB_SCORE_META = [
  { key: 'lightingScore'   as const, label: 'Lighting',       emoji: '💡', icon: Lightbulb },
  { key: 'crossingScore'  as const, label: 'Safe Crossings',  emoji: '🦺', icon: TrafficCone },
  { key: 'footpathScore'  as const, label: 'Footpath',        emoji: '🛤️', icon: Footprints },
  { key: 'slopeScore'     as const, label: 'Slope & Steps',   emoji: '⛰️', icon: MoveUpRight },
  { key: 'visibilityScore' as const, label: 'Visibility',     emoji: '👁️', icon: Eye },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function SegmentDrawer({ seg }: { seg: SegmentSafetyProfile }) {
  const label = getSafetyLabel(seg.totalScore);
  const colors = SCORE_COLORS[label];

  // A segment with crossingType 'none' that has no steps (i.e. indoor corridor)
  // should show N/A for crossing rather than a penalised score.
  const crossingIsNA = seg.crossingType === 'none' && !seg.hasSteps;

  const crossingDisplay = crossingIsNA
    ? 'N/A – no road crossing'
    : seg.crossingType;

  return (
    <div className={`mt-2 p-4 rounded-xl border ${colors.border} ${colors.bg} flex flex-col gap-3 text-sm`}>
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-on-surface">{seg.name}</span>
        <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${SCORE_BADGE[label]}`}>
          {seg.totalScore}/100 • {label.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
        Surface: {seg.footpathSurface} • Crossings: {crossingDisplay} • Slope: {seg.maxSlopePercent}%
      </p>
      <div className="grid grid-cols-5 gap-2">
        {SUB_SCORE_META.map(({ key, label: subLabel, emoji }) => {
          // Show N/A for crossing score when the segment has no road crossing
          if (key === 'crossingScore' && crossingIsNA) {
            return (
              <div key={key} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface-container/60 text-center">
                <span className="text-base" aria-hidden>{emoji}</span>
                <span className="text-xs font-bold text-on-surface-variant">N/A</span>
                <span className="text-[10px] text-on-surface-variant font-medium">{subLabel}</span>
              </div>
            );
          }
          const val = seg[key];
          const subLabel2 = getSafetyLabel(val >= 14 ? 80 : val >= 10 ? 60 : 40);
          return (
            <div key={key} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface-container/60 text-center">
              <span className="text-base" aria-hidden>{emoji}</span>
              <span className={`text-xs font-bold ${SCORE_COLORS[subLabel2].text}`}>{val}/20</span>
              <span className="text-[10px] text-on-surface-variant font-medium">{subLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CARD
// ─────────────────────────────────────────────────────────────────────────────

function RouteCard({
  route,
  rank,
  isExpanded,
  onToggle,
  persona,
  nightMode,
}: {
  route: RouteWithSafety;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
  persona: PersonaType;
  nightMode: boolean;
}) {
  const score = nightMode ? route.nightSafetyScore : route.compositeSafetyScore;
  const label = getSafetyLabel(score);
  const colors = SCORE_COLORS[label];
  const isSuitable = route.personaSuitability[persona];
  const distKm = (route.distanceMeters / 1000).toFixed(1);

  return (
    <article className={`rounded-2xl border ${colors.border} bg-surface-container-lowest shadow-sm transition-all duration-200 overflow-hidden`}>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-surface-container-high font-extrabold text-sm text-on-surface flex items-center justify-center">
              #{rank}
            </span>
            <div>
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                {route.label}
                {rank === 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary text-xs font-extrabold uppercase tracking-wide">
                    Safest Route
                  </span>
                )}
              </h3>
              <p className="text-xs text-on-surface-variant font-medium">
                {distKm} km • ~{route.estimatedMinutes} mins walking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl border ${colors.border} ${colors.bg} flex items-center gap-2`}>
              <span className={`text-2xl font-extrabold leading-none ${colors.text}`}>{score}</span>
              <div className="flex flex-col">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>{label}</span>
                <span className="text-[10px] text-on-surface-variant font-medium">Safety Score</span>
              </div>
            </div>

            <button
              onClick={onToggle}
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors cursor-pointer"
              aria-expanded={isExpanded}
              aria-label={`Toggle segment details for ${route.label}`}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-outline-variant/30 text-xs">
          <div className="flex items-center gap-2">
            {isSuitable ? (
              <span className="flex items-center gap-1 font-bold text-secondary">
                <CheckCircle2 className="w-4 h-4" />
                <span>Suitable for {PERSONA_META[persona].label}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-tertiary">
                <XCircle className="w-4 h-4" />
                <span>Caution for {PERSONA_META[persona].label}</span>
              </span>
            )}
          </div>
          <p className="text-on-surface-variant font-medium italic">{route.segments.length} Audited Segments</p>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 bg-surface-container-low border-t border-outline-variant/30 flex flex-col gap-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
            Segment Safety Audit ({route.segments.length} segments)
          </h4>
          {route.segments.map((seg, idx) => (
            <SegmentDrawer key={idx} seg={seg} />
          ))}
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARENTAL CONTROL & SAFETY ROUTING PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SafetyRoutingPage() {
  const { persona, setPersona, speakText, user } = useAccessibility();
  const [nightMode, setNightMode] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>('route-a');

  // Parental backend states
  const [parentData, setParentData] = useState<any>(null);
  const [loadingBackend, setLoadingBackend] = useState(true);
  const [inputPairingCode, setInputPairingCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState('');
  const [linkError, setLinkError] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings State
  const [curfewAlerts, setCurfewAlerts] = useState(true);
  const [geofenceAlerts, setGeofenceAlerts] = useState(true);
  const [sosPush, setSosPush] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch Parental Dashboard data from Backend API
  const fetchParentalData = useCallback(async () => {
    try {
      setLoadingBackend(true);
      const emailToFetch = user?.email || 'parent@community.org';
      const res = await fetch(`/api/parental/dashboard?email=${encodeURIComponent(emailToFetch)}`);
      const data = await res.json();
      if (res.ok) {
        setParentData(data);
      }
    } catch (err) {
      console.error('Failed to fetch parental control backend data', err);
    } finally {
      setLoadingBackend(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchParentalData();
  }, [fetchParentalData]);

  // Handle Account Linking
  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPairingCode) return;
    setIsLinking(true);
    setLinkError('');
    setLinkSuccess('');

    try {
      const res = await fetch('/api/parental/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_account',
          parentEmail: user?.email || 'parent@community.org',
          pairingCode: inputPairingCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pairing code validation failed');

      setLinkSuccess(`Successfully paired child account (${data.childName || 'Child'})!`);
      setInputPairingCode('');
      speakText('Child account linked successfully');
      fetchParentalData();
    } catch (err: any) {
      setLinkError(err.message || 'Failed to link account');
    } finally {
      setIsLinking(false);
    }
  };

  // Handle Unlink Account
  const handleUnlink = async (childEmail: string) => {
    if (!confirm(`Unlink child account (${childEmail})?`)) return;
    try {
      const res = await fetch('/api/parental/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlink_account',
          parentEmail: user?.email || 'parent@community.org',
          childEmail,
        }),
      });
      if (res.ok) {
        speakText('Child account unlinked');
        fetchParentalData();
      }
    } catch (err) {
      console.error('Failed to unlink account', err);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await fetch('/api/parental/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail: user?.email || 'parent@community.org',
          settings: { curfewAlerts, geofenceAlerts, sosPush },
        }),
      });
      speakText('Parental control settings updated');
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Ranked routes for route evaluation engine
  const rankedRoutes = useMemo(() => {
    return rankRoutesForPersona(DEMO_ROUTES, persona, nightMode);
  }, [persona, nightMode]);

  const best = rankedRoutes[0];

  return (
    <div className="min-h-screen bg-background text-on-surface py-8 px-4 sm:px-8 max-w-[1300px] mx-auto flex flex-col gap-8 pb-20">

      {/* ── HEADER SECTION ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-outline-variant/30 pb-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Parental Control & Safety Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-on-surface tracking-tight">
            Parental Controls & Route Safety Hub
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl font-medium leading-relaxed">
            Monitor family travel in real-time, link child accounts via pairing code, configure safety curfew restrictions, and review live route safety audit scores.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 font-bold text-xs text-on-surface flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span>Safety Settings</span>
          </button>
          <Link
            href="/parent-dashboard"
            className="px-5 h-11 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Full Parent Dashboard</span>
          </Link>
        </div>
      </div>

      {/* ── PARENTAL ACCOUNT LINKING & LIVE STATUS ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Account Pairing Form */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-on-surface">Link Child Account</h2>
              <p className="text-xs text-on-surface-variant font-medium">Enter the 6-digit code from the child app</p>
            </div>
          </div>

          <form onSubmit={handleLinkAccount} className="flex flex-col gap-3 mt-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputPairingCode}
                onChange={(e) => setInputPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code from dependent's app"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="6-digit pairing code"
                className="flex-1 h-12 px-4 rounded-xl bg-surface-container-high border border-outline-variant/40 text-on-surface font-mono font-bold text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-on-surface-variant/40 placeholder:font-sans placeholder:tracking-normal placeholder:text-sm"
              />
              <button
                type="submit"
                disabled={isLinking || !inputPairingCode}
                className="h-12 px-5 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity shadow-sm cursor-pointer"
              >
                {isLinking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Pair</span>
              </button>
            </div>

            {linkSuccess && (
              <p className="text-xs text-secondary font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {linkSuccess}
              </p>
            )}
            {linkError && (
              <p className="text-xs text-tertiary font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {linkError}
              </p>
            )}
          </form>

          <p className="text-[11px] text-on-surface-variant/70 font-medium">
            Ask the dependent to open their PathFinder app and share their 6-digit code.
          </p>
        </div>

        {/* Linked Children List & Real-time Alerts */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-base font-extrabold text-on-surface">Linked Family Accounts</h2>
              {!loadingBackend && (
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant">
                  {parentData?.linkedChildren?.length ?? 0} linked
                </span>
              )}
            </div>
            <button
              onClick={fetchParentalData}
              className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer"
              title="Refresh"
              aria-label="Refresh linked accounts"
            >
              <RefreshCw className={`w-4 h-4 ${loadingBackend ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingBackend ? (
            <div className="py-8 flex items-center justify-center text-xs text-on-surface-variant gap-2 font-semibold">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span>Syncing with parental backend APIs...</span>
            </div>
          ) : parentData?.linkedChildren && parentData.linkedChildren.length > 0 ? (
            <div className="flex flex-col gap-3">
              {parentData.linkedChildren.map((child: any) => (
                <div
                  key={child.id || child.email}
                  className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container font-extrabold text-sm flex items-center justify-center">
                      {child.name?.[0] || 'C'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                        {child.name || 'Child Device'}
                        <span className="w-2 h-2 rounded-full bg-secondary inline-block animate-pulse" title="Active" />
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium">{child.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => handleUnlink(child.email)}
                      className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                      title="Unlink this dependent"
                      aria-label={`Unlink ${child.name}`}
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-on-surface-variant font-medium">
              No dependents linked yet. Enter a 6-digit code above to pair.
            </div>
          )}

          {/* Quick Alert Feed */}
          <div className="pt-3 border-t border-outline-variant/30 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-secondary" />
                Live Safety Log
              </span>
              <span className="text-[11px] text-on-surface-variant/60 italic">
                Alerts appear here in real-time
              </span>
            </div>

            {parentData?.alerts && parentData.alerts.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                {parentData.alerts.slice(0, 3).map((a: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-tertiary/10 border border-tertiary/30 text-xs flex items-center justify-between">
                    <span className="font-bold text-tertiary">{a.message || 'Parental Safety Alert'}</span>
                    <span className="text-[10px] text-on-surface-variant">{a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'Just now'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant/70 italic">No critical alerts detected in the last 24 hours.</p>
            )}
          </div>
        </div>

      </div>

      {/* ── ROUTE SAFETY ENGINE & AUDIT SECTION ───────────────────────────── */}
      <div className="flex flex-col gap-6 border-t border-outline-variant/30 pt-8">

        {/* Section Heading & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold text-on-surface flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-secondary" />
              Child Route Safety & Audit Engine
            </h2>
            <p className="text-xs text-on-surface-variant font-medium">
              Assess footpath lighting, safe pedestrian crossings, and slope gradients for child mobility routes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Night mode toggle */}
            <button
              onClick={() => {
                setNightMode(prev => !prev);
                speakText(!nightMode ? 'Night mode route safety activated' : 'Day mode route safety activated');
              }}
              className={`h-10 px-4 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                nightMode
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/40'
              }`}
            >
              {nightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span>{nightMode ? 'Night Mode Active' : 'Day Mode'}</span>
            </button>
          </div>
        </div>

        {/* Persona Selector Tabs */}
        <div className="p-2 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-wrap gap-2">
          {(Object.keys(PERSONA_META) as PersonaType[]).map(p => {
            const { label, emoji } = PERSONA_META[p];
            const isSelected = persona === p;
            return (
              <button
                key={p}
                onClick={() => {
                  setPersona(p);
                  speakText(`Selected ${label} mobility profile`);
                }}
                className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span className="text-base">{emoji}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Top Safest Route Banner */}
        <section className="p-6 bg-gradient-to-r from-secondary/15 via-primary/10 to-transparent rounded-2xl border border-secondary/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-secondary uppercase tracking-widest">
              <Sparkles className="w-4 h-4" />
              <span>Recommended Child Safe Route</span>
            </div>
            <h3 className="text-2xl font-black text-on-surface">
              {best.label}
            </h3>
            <p className="text-xs text-on-surface-variant max-w-xl font-medium leading-relaxed">
              Evaluated with high illumination rating and dedicated pedestrian crossing signals.
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col items-end">
              <span className="text-3xl font-black text-secondary leading-none">
                {nightMode ? best.nightSafetyScore : best.compositeSafetyScore}/100
              </span>
              <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                Composite Score
              </span>
            </div>
            <Link
              href="/micro-navigation"
              className="px-5 h-12 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer"
            >
              <Navigation className="w-4 h-4 fill-current" />
              <span>Start Navigation</span>
            </Link>
          </div>
        </section>

        {/* Route Comparison List */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-extrabold text-on-surface uppercase tracking-wider">
            All Evaluated Routes ({rankedRoutes.length})
          </h3>
          {rankedRoutes.map((route, i) => (
            <RouteCard
              key={route.routeId}
              route={route}
              rank={i + 1}
              isExpanded={expandedRoute === route.routeId}
              onToggle={() => {
                setExpandedRoute(prev => prev === route.routeId ? null : route.routeId);
                speakText(`${route.label}: safety score ${nightMode ? route.nightSafetyScore : route.compositeSafetyScore} out of 100`);
              }}
              persona={persona}
              nightMode={nightMode}
            />
          ))}
        </div>

      </div>

      {/* ── SETTINGS MODAL ────────────────────────────────────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-on-surface flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                Parental Control Preferences
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-on-surface">Night Curfew Breach Alerts</span>
                  <span className="text-xs text-on-surface-variant">Notify if traveling between 8 PM - 6 AM</span>
                </div>
                <input
                  type="checkbox"
                  checked={curfewAlerts}
                  onChange={(e) => setCurfewAlerts(e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-on-surface">Geofence Boundary Exit Alerts</span>
                  <span className="text-xs text-on-surface-variant">Alert when exiting designated safe zones</span>
                </div>
                <input
                  type="checkbox"
                  checked={geofenceAlerts}
                  onChange={(e) => setGeofenceAlerts(e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-on-surface">Emergency SOS Push Notifications</span>
                  <span className="text-xs text-on-surface-variant">Instant high-priority alarm on child panic press</span>
                </div>
                <input
                  type="checkbox"
                  checked={sosPush}
                  onChange={(e) => setSosPush(e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 h-11 rounded-xl bg-surface-container-high text-on-surface font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-5 h-11 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
