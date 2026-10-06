'use client';

/**
 * MultiSensoryNavPanel — UI Component
 * PathFinder Access
 *
 * Provides a visual + accessible debug/control panel for the
 * Multi-Sensory Navigation Module. Designed for integration into
 * the GPS Precision or Safety Routing pages.
 *
 * Features:
 *  • Live instruction badge with icon + colour coding
 *  • Haptic / Audio / Headphone status indicators
 *  • Manual cue buttons for each instruction (demo / testing)
 *  • ARIA live region for screen-reader announcements
 *  • Battery-level warning
 *  • Start / Stop controls
 */

import React, { useCallback, useId } from 'react';
import {
  Navigation,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Vibrate,
  Volume2,
  VolumeX,
  Headphones,
  HeadphoneOff,
  BatteryLow,
  Play,
  Square,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { useMultiSensoryNav } from '@/hooks/useMultiSensoryNav';
import { NavQueueManager } from '@/lib/multiSensoryNav/navQueueManager';
import type { NavInstruction, NavWaypoint } from '@/lib/multiSensoryNav/types';
import type { Coordinates } from '@/lib/spatial';

// ─────────────────────────────────────────────
// Initial fallback waypoints (replace with real route data)
// ─────────────────────────────────────────────

function buildInitialWaypoints(origin: Coordinates): NavWaypoint[] {
  // Simulated 4-waypoint route: Straight → Left → Right → Arrived
  const offsets: [number, number, NavInstruction][] = [
    [0.0001,  0,       'straight'  ],
    [0.0002,  0.0001, 'turn_left' ],
    [0.0003,  0.0002, 'turn_right'],
    [0.0004,  0.0002, 'arrived'   ],
  ];

  return offsets.map(([dLat, dLng, instr], i) =>
    NavQueueManager.createWaypoint(
      `nav-wp-${i}`,
      { lat: origin.lat + dLat, lng: origin.lng + dLng },
      instr,
      instr === 'turn_left'  ? 'Turn left ahead' :
      instr === 'turn_right' ? 'Turn right ahead' :
      instr === 'arrived'    ? 'You have arrived' :
      'Continue straight',
      20  // 20 m trigger radius for demo
    )
  );
}

// ─────────────────────────────────────────────
// INSTRUCTION DISPLAY CONFIG
// ─────────────────────────────────────────────

interface InstructionConfig {
  label: string;
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const INSTRUCTION_CONFIG: Record<NavInstruction, InstructionConfig> = {
  straight: {
    label: 'Continue Straight',
    icon: <Navigation className="w-5 h-5" />,
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/40',
  },
  turn_left: {
    label: 'Turn Left',
    icon: <ArrowLeft className="w-5 h-5" />,
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/40',
  },
  turn_right: {
    label: 'Turn Right',
    icon: <ArrowRight className="w-5 h-5" />,
    bgClass: 'bg-violet-500/15',
    textClass: 'text-violet-400',
    borderClass: 'border-violet-500/40',
  },
  arrived: {
    label: 'Destination Reached',
    icon: <CheckCircle2 className="w-5 h-5" />,
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40',
  },
};

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface MultiSensoryNavPanelProps {
  /** Current user GPS position — used to seed demo waypoints */
  userCoord?: Coordinates;
  /** If provided, these waypoints are used instead of the demo set */
  waypoints?: NavWaypoint[];
  /** Called when navigation ends (arrived or stopped) */
  onNavigationEnd?: () => void;
  className?: string;
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function MultiSensoryNavPanel({
  userCoord,
  waypoints,
  onNavigationEnd,
  className = '',
}: MultiSensoryNavPanelProps) {
  const liveRegionId = useId();
  const { state, startNavigation, stopNavigation, fireCueManually } = useMultiSensoryNav();

  // ── Start handler ────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const origin = userCoord ?? { lat: 19.076, lng: 72.877 }; // Mumbai default
    const wps = waypoints ?? buildInitialWaypoints(origin);
    await startNavigation(wps);
  }, [userCoord, waypoints, startNavigation]);

  // ── Stop handler ──────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    stopNavigation();
    onNavigationEnd?.();
  }, [stopNavigation, onNavigationEnd]);

  // ── Manual cue buttons ───────────────────────────────────────────────────
  const handleManualCue = useCallback(async (instruction: NavInstruction) => {
    const origin = userCoord ?? { lat: 0, lng: 0 };
    const wp = NavQueueManager.createWaypoint(
      `manual-${instruction}-${Date.now()}`,
      origin,
      instruction,
      INSTRUCTION_CONFIG[instruction].label,
    );
    await fireCueManually(wp);
  }, [userCoord, fireCueManually]);

  // ── Derived display ──────────────────────────────────────────────────────
  const instrConfig = state.currentInstruction
    ? INSTRUCTION_CONFIG[state.currentInstruction]
    : null;

  return (
    <section
      className={`rounded-3xl border border-outline-variant/30 bg-surface-container-lowest overflow-hidden shadow-lg ${className}`}
      aria-label="Multi-Sensory Navigation Control Panel"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-on-surface">Multi-Sensory Navigation</h2>
            <p className="text-xs text-on-surface-variant font-medium">
              Haptic · Spatial Audio · Voice
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          <StatusBadge
            icon={state.headphonesConnected
              ? <Headphones className="w-3.5 h-3.5" />
              : <HeadphoneOff className="w-3.5 h-3.5" />}
            label={state.headphonesConnected ? 'Headphones' : 'Speakers'}
            active={state.headphonesConnected}
          />
          <StatusBadge
            icon={<Vibrate className="w-3.5 h-3.5" />}
            label="Haptic"
            active={state.hapticBusy}
            busy
          />
          <StatusBadge
            icon={state.hapticBusy || state.audioBusy
              ? <Volume2 className="w-3.5 h-3.5" />
              : <VolumeX className="w-3.5 h-3.5" />}
            label="Audio"
            active={state.audioBusy}
            busy
          />
        </div>
      </div>

      {/* ── ARIA live region (screen-reader announcements) ──────────────── */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {state.currentInstruction
          ? INSTRUCTION_CONFIG[state.currentInstruction].label
          : ''}
      </div>

      {/* ── Current Instruction ─────────────────────────────────────────── */}
      <div className="px-5 py-5">
        {instrConfig ? (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${instrConfig.bgClass} ${instrConfig.borderClass} transition-all duration-300`}
            aria-label={`Current instruction: ${instrConfig.label}`}
          >
            <span className={`${instrConfig.textClass} flex-shrink-0`}>
              {instrConfig.icon}
            </span>
            <span className={`text-base font-black ${instrConfig.textClass}`}>
              {instrConfig.label}
            </span>
            {(state.hapticBusy || state.audioBusy) && (
              <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant ml-auto" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-outline-variant/20 bg-surface-container text-on-surface-variant">
            <MapPin className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-semibold">
              {state.isActive ? 'Awaiting next waypoint…' : 'Navigation not started'}
            </span>
          </div>
        )}
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      {state.isActive && (
        <div className="px-5 pb-4 grid grid-cols-3 gap-2 text-center">
          <StatCell label="Remaining" value={String(state.remainingWaypoints)} />
          <StatCell label="Audio" value={state.headphonesConnected ? '3D Spatial' : 'Mono'} />
          <StatCell label="Status" value={state.isActive ? 'Active' : 'Idle'} />
        </div>
      )}

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {state.error && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-semibold flex items-center gap-2">
          <BatteryLow className="w-4 h-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      {/* ── Manual Test Cues ────────────────────────────────────────────── */}
      <div className="px-5 pb-4">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant mb-2">
          Test Cues
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(INSTRUCTION_CONFIG) as NavInstruction[]).map(instr => {
            const cfg = INSTRUCTION_CONFIG[instr];
            return (
              <button
                key={instr}
                id={`msn-test-${instr}`}
                onClick={() => handleManualCue(instr)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
                aria-label={`Test ${cfg.label} cue`}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Start / Stop ────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 flex gap-3">
        {!state.isActive ? (
          <button
            id="msn-start-btn"
            onClick={handleStart}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary text-on-primary font-black text-sm shadow-md hover:opacity-95 transition-all active:scale-95"
            aria-label="Start multi-sensory navigation"
          >
            <Play className="w-4 h-4" />
            Start Navigation
          </button>
        ) : (
          <button
            id="msn-stop-btn"
            onClick={handleStop}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-error/10 border border-error/30 text-error font-black text-sm hover:bg-error/15 transition-all active:scale-95"
            aria-label="Stop navigation"
          >
            <Square className="w-4 h-4" />
            Stop Navigation
          </button>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

interface StatusBadgeProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  busy?: boolean;
}

function StatusBadge({ icon, label, active, busy }: StatusBadgeProps) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
        active
          ? busy
            ? 'bg-primary/10 text-primary border-primary/30 animate-pulse'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : 'bg-surface-container text-on-surface-variant border-outline-variant/20'
      }`}
      aria-label={`${label}: ${active ? 'active' : 'inactive'}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

interface StatCellProps {
  label: string;
  value: string;
}

function StatCell({ label, value }: StatCellProps) {
  return (
    <div className="bg-surface-container rounded-xl px-3 py-2">
      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className="text-sm font-black text-on-surface">{value}</p>
    </div>
  );
}
