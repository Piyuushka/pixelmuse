'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccessibility, PersonaType } from '@/context/AccessibilityContext';
import {
  ShieldCheck,
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
  Info,
  Star,
  AlertTriangle,
  Sliders,
  Layers,
  CircleSlash,
  TrendingUp,
} from 'lucide-react';
import {
  DEMO_ROUTES,
  rankRoutesForPersona,
  getSafetyLabel,
  RouteWithSafety,
  SegmentSafetyProfile,
  SafetyLabel,
  SurfaceFilterPreferences,
} from '@/lib/safetyRoutingEngine';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
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

  return (
    <div className={`mt-2 p-4 rounded-xl border ${colors.border} ${colors.bg} flex flex-col gap-3 text-sm`}>
      {/* Sub-score bars */}
      <div className="flex flex-col gap-2">
        {SUB_SCORE_META.map(({ key, label: subLabel, emoji }) => {
          const val = seg[key];
          const subLabel2 = getSafetyLabel(val >= 14 ? 80 : val >= 10 ? 60 : 40);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-5 text-center text-base flex-shrink-0" aria-hidden>{emoji}</span>
              <span className="w-28 font-semibold text-on-surface-variant text-xs flex-shrink-0">{subLabel}</span>
              <div className="flex-1">
                <ScoreBar value={val} max={20} label={subLabel2} />
              </div>
              <span className={`font-extrabold text-xs w-6 text-right ${SCORE_COLORS[subLabel2].text}`}>
                {val}
              </span>
            </div>
          );
        })}
      </div>

      {/* Detail chips */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline-variant/20">
        {seg.hasTactilePaving && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">Tactile Paving</span>
        )}
        {!seg.hasSteps && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">Step-Free</span>
        )}
        {seg.isLit && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
            {seg.streetlampDensityPerKm} lamps/km
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant">
          {seg.footpathWidthCm}cm wide
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant capitalize">
          {seg.crossingType} crossing
        </span>
        {seg.maxSlopePercent > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant">
            {seg.maxSlopePercent}% slope
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant">
          Audited {seg.lastAuditedAt}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CARD
// ─────────────────────────────────────────────────────────────────────────────

function RouteCard({
  route,
  isExpanded,
  onToggle,
  persona,
  nightMode,
  rank,
}: {
  route: RouteWithSafety;
  isExpanded: boolean;
  onToggle: () => void;
  persona: PersonaType;
  nightMode: boolean;
  rank: number;
}) {
  const [expandedSeg, setExpandedSeg] = useState<string | null>(null);
  const score = nightMode ? route.nightSafetyScore : route.compositeSafetyScore;
  const label = getSafetyLabel(score);
  const colors = SCORE_COLORS[label];
  const badgeClass = SCORE_BADGE[label];
  const isTop = route.isRecommendedForPersona;

  const labelText = label === 'safe' ? 'Safe' : label === 'moderate' ? 'Moderate' : 'Caution';

  return (
    <div
      className={`rounded-2xl border-2 transition-all duration-200 shadow-xs overflow-hidden ${
        route.isBlockedByHazard
          ? 'border-error/40 bg-error-container/5'
          : isTop
          ? `border-secondary shadow-md ${colors.bg}`
          : `border-outline-variant/40 bg-surface-container-lowest`
      }`}
    >
      {/* Card Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-5 flex items-start gap-4 focus:outline-none focus:ring-2 focus:ring-primary rounded-2xl"
        aria-expanded={isExpanded}
      >
        {/* Rank circle */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0 shadow-xs ${
          route.isBlockedByHazard
            ? 'bg-error text-white'
            : isTop
            ? 'bg-secondary text-on-secondary'
            : 'bg-surface-container-high text-on-surface-variant'
        }`}>
          {route.isBlockedByHazard ? '✕' : isTop ? <Star className="w-5 h-5" /> : rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-extrabold text-base text-on-surface">{route.label}</span>
            {isTop && !route.isBlockedByHazard && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-secondary text-on-secondary uppercase tracking-wider">
                Recommended
              </span>
            )}
            {route.isBlockedByHazard && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-error text-white uppercase tracking-wider animate-pulse">
                Blocked
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-on-surface-variant">
            <span>{(route.distanceMeters / 1000).toFixed(2)} km</span>
            <span className="h-3 w-px bg-outline-variant/40" />
            <span>{route.estimatedMinutes} min est.</span>
            <span className="h-3 w-px bg-outline-variant/40" />
            <span>{route.segments.length} segments</span>
          </div>

          {/* Hazard Reroute Alerts */}
          {route.isBlockedByHazard && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-error-container/20 border border-error/50 flex items-center gap-2 text-xs font-bold text-error">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse text-error" />
              <span>Blocked by Reported Hazard: {route.hazardBlockReason || 'Obstacle on route'}</span>
            </div>
          )}
          {route.detourNotice && !route.isBlockedByHazard && (
            <div className="mt-2.5 p-2 rounded-xl bg-secondary-container/40 border border-secondary/40 flex items-center gap-2 text-xs font-bold text-secondary">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-secondary" />
              <span>Recommended Adapted Route ({route.detourNotice})</span>
            </div>
          )}

          {/* Surface Quality Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {route.surfaceQualityBadges?.map((b) => (
              <span
                key={b.label}
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 ${
                  b.type === 'safe'
                    ? 'bg-secondary-container/50 text-secondary border border-secondary/30'
                    : b.type === 'warning'
                    ? 'bg-error-container/30 text-error border border-error/40'
                    : b.type === 'caution'
                    ? 'bg-tertiary-container/40 text-tertiary border border-tertiary/40'
                    : 'bg-primary-container/30 text-primary border border-primary/30'
                }`}
              >
                <span>{b.label}</span>
              </span>
            ))}
          </div>

          {/* Surface Filter Violations or Compliance */}
          {route.filterViolations && route.filterViolations.length > 0 ? (
            <div className="flex flex-col gap-1 mt-2">
              {route.filterViolations.map((v) => (
                <span key={v} className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                  ⚠️ {v}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[10px] font-bold text-secondary dark:text-emerald-400 mt-1.5 flex items-center gap-1">
              ✓ Meets active surface & infrastructure preferences
            </div>
          )}

          {/* Persona badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {(Object.keys(PERSONA_META) as PersonaType[]).map(p => {
              const suitable = route.personaSuitability[p];
              return (
                <span
                  key={p}
                  title={`${PERSONA_META[p].label}: ${suitable ? 'Suitable' : 'Not recommended'}`}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    suitable
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container text-on-surface-variant/50 line-through'
                  }`}
                >
                  {PERSONA_META[p].emoji}
                  <span className="hidden sm:inline">{PERSONA_META[p].label}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Score bubble + expand arrow */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-xs border ${colors.border} ${colors.bg}`}>
            <span className={`text-xl font-black leading-none ${colors.text}`}>{score}</span>
            <span className={`text-[9px] font-extrabold uppercase tracking-wider ${colors.text}`}>/100</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${badgeClass}`}>
            {labelText}
          </span>
          <div className="text-on-surface-variant mt-1">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Segments */}
      {isExpanded && (
        <div className="px-5 pb-5 flex flex-col gap-3 border-t border-outline-variant/20 pt-4">
          {/* Composite sub-score summary */}
          <div className="grid grid-cols-5 gap-1">
            {SUB_SCORE_META.map(({ key, label: subLabel, emoji }) => {
              const avg = Math.round(route.segments.reduce((a, s) => a + s[key], 0) / route.segments.length);
              const avgLabel = getSafetyLabel(avg >= 14 ? 80 : avg >= 10 ? 60 : 40);
              return (
                <div key={key} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <span className="text-lg" aria-hidden>{emoji}</span>
                  <span className={`text-sm font-extrabold ${SCORE_COLORS[avgLabel].text}`}>{avg}</span>
                  <span className="text-[9px] font-bold text-on-surface-variant text-center leading-tight">{subLabel}</span>
                </div>
              );
            })}
          </div>

          <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">
            Route Segments — click to inspect
          </h4>

          {route.segments.map(seg => {
            const segLabel = getSafetyLabel(seg.totalScore);
            const segColors = SCORE_COLORS[segLabel];
            const open = expandedSeg === seg.id;
            return (
              <div key={seg.id}>
                <button
                  type="button"
                  onClick={() => setExpandedSeg(open ? null : seg.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-primary ${
                    open ? `${segColors.border} ${segColors.bg}` : 'border-outline-variant/30 bg-surface-container-low'
                  }`}
                  aria-expanded={open}
                >
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${segColors.bg} ${segColors.border} border`}>
                    <span className={`text-sm font-black leading-none ${segColors.text}`}>{seg.totalScore}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-on-surface truncate">{seg.name}</div>
                    <div className="text-xs text-on-surface-variant font-medium">{seg.distanceMeters}m</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {seg.hasSteps && (
                      <span title="Has steps"><XCircle className="w-4 h-4 text-tertiary" /></span>
                    )}
                    {seg.hasTactilePaving && (
                      <span title="Tactile paving"><CheckCircle2 className="w-4 h-4 text-secondary" /></span>
                    )}
                    {open ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                  </div>
                </button>

                {open && <SegmentDrawer seg={seg} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGEND
// ─────────────────────────────────────────────────────────────────────────────

function SafetyLegend() {
  return (
    <div className="flex flex-wrap gap-2 items-center text-xs font-bold">
      <span className="text-on-surface-variant font-extrabold">Legend:</span>
      {([['safe', '≥ 80', 'bg-secondary text-on-secondary'], ['moderate', '50–79', 'bg-primary text-on-primary'], ['caution', '< 50', 'bg-tertiary text-on-tertiary']] as const).map(([l, r, cls]) => (
        <span key={l} className={`px-2.5 py-1 rounded-full uppercase tracking-wide ${cls}`}>
          {l} {r}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SafetyRoutingPage() {
  const {
    persona,
    speakText,
    isDarkMode,
    toggleDarkMode,
    surfaceFilters,
    toggleSurfaceFilter,
    activeHazardAlert,
  } = useAccessibility();
  const nightMode = isDarkMode;
  const [expandedRoute, setExpandedRoute] = useState<string | null>('route-a');

  const rankedRoutes = useMemo(
    () => rankRoutesForPersona(DEMO_ROUTES, persona, nightMode, surfaceFilters, activeHazardAlert),
    [persona, nightMode, surfaceFilters, activeHazardAlert],
  );

  const best = rankedRoutes[0];
  const bestScore = nightMode ? best.nightSafetyScore : best.compositeSafetyScore;

  const toggleNight = () => {
    toggleDarkMode();
    speakText(!isDarkMode
      ? 'Night mode active. Lighting weighted at 40 percent. Recommended route updated.'
      : 'Day mode restored. Standard scoring active.'
    );
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-[900px] flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shadow-md flex-shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
                Safety + Accessibility Routing
              </h1>
              <p className="text-on-surface-variant text-base font-medium">
                Routes scored on lighting, crossings, footpath condition &amp; slope — for everyone.
              </p>
            </div>
          </div>

          {/* Night Mode Toggle */}
          <button
            type="button"
            onClick={toggleNight}
            id="night-mode-toggle"
            aria-label={`Toggle Night Mode. Currently ${nightMode ? 'Night Mode Active' : 'Day Mode Active'}`}
            aria-pressed={nightMode}
            className={`h-12 px-5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary flex-shrink-0 cursor-pointer ${
              nightMode
                ? 'bg-primary text-white shadow-md ring-2 ring-primary/40'
                : 'bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/40 text-on-surface'
            }`}
          >
            {nightMode ? <Moon className="w-4 h-4 text-white" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>{nightMode ? 'Night Mode' : 'Day Mode'}</span>
          </button>
        </div>

        {/* ── Live Obstacle Avoidance Alert Banner ──────────────────────────── */}
        {activeHazardAlert?.active && (
          <div className="p-5 rounded-3xl bg-tertiary-container/20 border-2 border-tertiary/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-tertiary/20 text-tertiary flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-tertiary tracking-wider">
                    Dynamic Obstacle Avoidance Active
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-tertiary text-white">
                    {activeHazardAlert.detourTime}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-on-surface mt-0.5">
                  {activeHazardAlert.title}
                </h3>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  📍 {activeHazardAlert.location} · {activeHazardAlert.impact}
                </p>
              </div>
            </div>

            <Link
              href="/live-adaptation-alert"
              className="px-4 py-2.5 rounded-xl bg-tertiary text-on-tertiary font-extrabold text-xs flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap self-start sm:self-center"
            >
              <span>View Reroute Details</span>
              <MoveUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* ── Surface Type & Infrastructure Controls Bar ───────────────────── */}
        <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <span className="text-xs font-extrabold text-on-surface uppercase tracking-wider">
                Surface & Infrastructure Filters
              </span>
            </div>
            <span className="text-[11px] font-semibold text-secondary">
              Synchronized with Mobility Profile
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'avoidCobblestones' as const, label: 'Avoid Cobblestones', icon: Layers },
              { key: 'avoidUnpavedGravel' as const, label: 'Avoid Unpaved/Gravel', icon: CircleSlash },
              { key: 'avoidSteepInclines' as const, label: 'Avoid Steep (>5%)', icon: TrendingUp },
              { key: 'preferTactilePaving' as const, label: 'Prefer Tactile Paving', icon: Footprints },
              { key: 'preferSignalizedCrossings' as const, label: 'Prefer Signals', icon: TrafficCone },
              { key: 'wellLitOnly' as const, label: 'Well-Lit Only', icon: Lightbulb },
            ].map((f) => {
              const active = surfaceFilters[f.key];
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    toggleSurfaceFilter(f.key);
                    speakText(`${f.label} filter ${!active ? 'enabled' : 'disabled'}`);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    active
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant/30 text-on-surface-variant'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{f.label}</span>
                  {active && <span className="text-[10px] ml-0.5">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Night mode info banner ──────────────────────────────────────── */}
        {nightMode && (
          <div className="p-4 rounded-2xl bg-surface-container-low dark:bg-slate-800/80 border border-secondary/30 dark:border-secondary/50 flex items-start gap-3 shadow-xs">
            <Moon className="w-5 h-5 text-secondary dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-sm text-on-surface">Night Mode Active</span>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Lighting is weighted at <strong>40%</strong> of the composite score (vs 20% in day mode).
                Routes with poor illumination are penalised more heavily — ideal for anyone walking after dark.
              </p>
            </div>
          </div>
        )}

        {/* ── Hero score card ─────────────────────────────────────────────── */}
        <section
          aria-labelledby="recommended-route-heading"
          className="p-6 bg-gradient-to-br from-secondary-container/20 to-primary-container/10 rounded-3xl border border-secondary/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
        >
          <div className="flex items-center gap-5">
            {/* Big score dial */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" strokeWidth="8" className="stroke-surface-container-high" />
                <circle
                  cx="40" cy="40" r="34" fill="none" strokeWidth="8"
                  className="stroke-secondary"
                  strokeDasharray={`${(bestScore / 100) * 213.6} 213.6`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-secondary leading-none">{bestScore}</span>
                <span className="text-[9px] font-bold text-on-surface-variant">/100</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-secondary uppercase tracking-wider">
                {PERSONA_META[persona].emoji} Best for {PERSONA_META[persona].label}
              </div>
              <h2 id="recommended-route-heading" className="text-xl font-extrabold text-on-surface mt-0.5">
                {best.label}
              </h2>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                {(best.distanceMeters / 1000).toFixed(2)} km · {best.estimatedMinutes} min · {best.segments.length} segments audited
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(Object.keys(PERSONA_META) as PersonaType[]).filter(p => best.personaSuitability[p]).map(p => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                    {PERSONA_META[p].emoji} {PERSONA_META[p].label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sub-score chips */}
          <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5 w-full sm:w-auto">
            {SUB_SCORE_META.map(({ key, label: subLabel, emoji }) => {
              const avg = Math.round(best.segments.reduce((a, s) => a + s[key], 0) / best.segments.length);
              const l = getSafetyLabel(avg >= 14 ? 80 : avg >= 10 ? 60 : 40);
              return (
                <div key={key} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border ${SCORE_COLORS[l].border} ${SCORE_COLORS[l].bg}`}>
                  <span className="text-xl" aria-hidden>{emoji}</span>
                  <span className={`text-base font-extrabold leading-none ${SCORE_COLORS[l].text}`}>{avg}</span>
                  <span className="text-[9px] font-bold text-on-surface-variant text-center leading-tight">{subLabel}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Legend + audience note ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SafetyLegend />
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-semibold">
            <Info className="w-3.5 h-3.5" />
            <span>Switch mobility profile in the sidebar to re-rank routes.</span>
          </div>
        </div>

        {/* ── Route comparison list ───────────────────────────────────────── */}
        <section aria-labelledby="route-list-heading" className="flex flex-col gap-4">
          <h2 id="route-list-heading" className="text-base font-extrabold text-on-surface uppercase tracking-wide">
            Route Comparison ({rankedRoutes.length} routes)
          </h2>

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
        </section>

        {/* ── Audience widening callout ───────────────────────────────────── */}
        <section className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-xs flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-secondary" />
            <h2 className="font-extrabold text-base text-on-surface">Who benefits?</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(PERSONA_META) as PersonaType[]).map(p => {
              const { label, emoji, icon: Icon } = PERSONA_META[p];
              const suitableCount = rankedRoutes.filter(r => r.personaSuitability[p]).length;
              return (
                <div key={p} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-center">
                  <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
                    <Icon className="w-5 h-5 text-on-secondary-container" />
                  </div>
                  <span className="text-sm font-bold text-on-surface">{label}</span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {suitableCount}/{rankedRoutes.length} routes suitable
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
            Safety routing widens our audience beyond wheelchair users — covering visually impaired users, older adults, and anyone walking at night. Every route score is based on real audited segment data.
          </p>
        </section>

        {/* ── CTAs ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/gps-precision?autonav=1"
            id="start-navigation-cta"
            className="flex-1 h-14 rounded-xl bg-primary text-on-primary font-bold text-base flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity"
          >
            <Navigation className="w-5 h-5 fill-current" />
            <span>Start Safe Navigation</span>
          </Link>
          <Link
            href="/community-confidence?action=report"
            className="px-6 h-14 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-sm text-on-surface flex items-center justify-center gap-2 transition-colors"
          >
            <ShieldCheck className="w-5 h-5 text-secondary" />
            <span>Report a Hazard</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
