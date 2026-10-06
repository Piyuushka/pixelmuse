'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  MapPin,
  Clock,
  ShieldCheck,
  Navigation,
  Compass,
  Sliders,
  Layers,
  TrendingUp,
  CircleSlash,
  Footprints,
  TrafficCone,
  Lightbulb,
  Pause,
  Play,
  CornerDownRight,
  ShieldAlert,
} from 'lucide-react';

function LiveAdaptationAlertContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportIdParam = searchParams.get('reportId');

  const {
    activeHazardAlert,
    barrierReports,
    simulatedObstacle,
    toggleSimulatedObstacle,
    acceptReroute,
    surfaceFilters,
    toggleSurfaceFilter,
    speakText,
    persona,
  } = useAccessibility();

  // Find report from URL param if available
  const reportFromUrl = reportIdParam
    ? barrierReports.find(r => r.id === reportIdParam)
    : null;

  const hazard = reportFromUrl
    ? {
        active: true,
        title: reportFromUrl.title,
        location: reportFromUrl.location,
        microLocation: reportFromUrl.microLocation,
        detourTime: activeHazardAlert?.barrierReportId === reportFromUrl.id ? activeHazardAlert.detourTime : '+3 min detour',
        impact: reportFromUrl.description || 'Active obstacle reported by community. Step-free detour available.',
        category: reportFromUrl.category,
        severity: reportFromUrl.severity,
        barrierReportId: reportFromUrl.id,
        originalRoute: `Original Route (Blocked by ${reportFromUrl.title})`,
        originalRouteDetail: `Direct path obstructed at ${reportFromUrl.location}. Inaccessible for ${persona} profile.`,
        adaptedRoute: `Recommended Adapted Route (Bypasses obstacle with +3 min detour)`,
        adaptedRouteDetail: `Continuous step-free path via accessible ramp and signalized crossing.`,
        isAccepted: activeHazardAlert?.isAccepted || false,
        rerouteResult: activeHazardAlert?.rerouteResult,
      }
    : (activeHazardAlert || simulatedObstacle);

  const detourTimeText = hazard.detourTime || '+3 min detour';
  const originalTitle = hazard.originalRoute || `Original Planned Route (Blocked by ${hazard.title})`;
  const adaptedTitle = hazard.adaptedRoute || `Recommended Adapted Route (Bypasses obstacle with ${detourTimeText})`;

  // Countdown auto-redirect state (~3 seconds)
  const [countdown, setCountdown] = useState<number>(3);
  const [isCountdownPaused, setIsCountdownPaused] = useState<boolean>(false);

  // Announce alert on mount via speech
  useEffect(() => {
    speakText(
      `Live Adaptation Alert: ${hazard.title} at ${hazard.location}. ${detourTimeText}. 100% step-free adapted route calculated.`
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle countdown interval
  useEffect(() => {
    if (isCountdownPaused || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleProceedToMap();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCountdownPaused, countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProceedToMap = useCallback(() => {
    acceptReroute();
    const targetReportId = reportIdParam || hazard.barrierReportId || 'active';
    speakText(`Adapted route confirmed. Navigating to GPS Precision Map along step-free detour.`);
    router.push(`/gps-precision?reroute=active&reportId=${encodeURIComponent(targetReportId)}&autonav=1`);
  }, [acceptReroute, hazard.barrierReportId, reportIdParam, router, speakText]);

  const togglePauseCountdown = () => {
    setIsCountdownPaused(prev => !prev);
    speakText(!isCountdownPaused ? 'Auto navigation paused. Reviewing route adaptation.' : 'Auto navigation resumed.');
  };

  const hasNoStepFreeAlt = hazard.rerouteResult?.isStepFree === false || hazard.rerouteResult?.nearestAccessibleEntrance;

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-[850px] flex flex-col gap-6">

        {/* Aria-live announcement region */}
        <div className="sr-only" role="alert" aria-live="assertive">
          Live Hazard Warning: {hazard.title} at {hazard.location}. Adapted route with {detourTimeText} ready.
        </div>

        {/* Top Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-tertiary text-on-tertiary flex items-center justify-center shadow-md">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
              Live Adaptation Alert
            </h1>
            <p className="text-on-surface-variant text-base font-medium">
              Real-time obstacle detector & automatic accessible rerouting system.
            </p>
          </div>
        </div>

        {/* Auto-Navigation Countdown Banner */}
        <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm shrink-0">
              {countdown > 0 ? countdown : '✓'}
            </div>
            <div>
              <p className="text-sm font-extrabold text-on-surface">
                {countdown > 0
                  ? (isCountdownPaused ? 'Auto-nav paused. Click Resume or Accept below.' : `Auto-navigating to GPS Precision Map in ${countdown}s...`)
                  : 'Redirecting to Map navigation now...'}
              </p>
              <p className="text-xs text-on-surface-variant font-medium">
                Step-free detour calculated and ready for turn-by-turn guidance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              type="button"
              onClick={togglePauseCountdown}
              className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-xs text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isCountdownPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-primary" />
                  <span>Resume Countdown</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-tertiary" />
                  <span>Pause Auto-Nav</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleProceedToMap}
              className="px-4 py-2 rounded-xl bg-secondary text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>Accept Now →</span>
            </button>
          </div>
        </div>

        {/* Main Alert Card */}
        <div className="p-6 md:p-8 bg-surface-container-lowest rounded-3xl border-2 border-tertiary shadow-xl flex flex-col gap-6">

          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tertiary/15 text-tertiary flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-tertiary uppercase tracking-wider">
                    Active Hazard Warning
                  </span>
                  {hazard.severity && (
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      hazard.severity === 'critical'
                        ? 'bg-error text-white'
                        : 'bg-tertiary text-on-tertiary'
                    }`}>
                      {hazard.severity} Severity
                    </span>
                  )}
                  {hazard.isAccepted && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-secondary-container text-secondary">
                      Reroute Accepted
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-extrabold text-on-surface mt-0.5">
                  {hazard.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                toggleSimulatedObstacle();
                speakText(hazard.active ? "Simulated obstacle resolved. Original path restored." : "Simulated obstacle activated.");
              }}
              className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-center cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-primary" />
              <span>{hazard.active ? 'Simulate Obstacle Fix' : 'Re-activate Alert'}</span>
            </button>
          </div>

          {/* Location & Impact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-on-surface-variant">Affected Location &amp; Micro-Anchor</div>
                <div className="text-sm font-extrabold text-on-surface">{hazard.location}</div>
                {hazard.microLocation && hazard.microLocation !== hazard.location && (
                  <div className="text-xs font-medium text-primary mt-0.5">
                    📍 {hazard.microLocation}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3">
              <Clock className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-on-surface-variant">Reroute Impact</div>
                <div className="text-sm font-extrabold text-secondary">{detourTimeText}</div>
                <div className="text-xs font-medium text-on-surface-variant mt-0.5">
                  {hazard.impact}
                </div>
              </div>
            </div>
          </div>

          {/* Edge Case Warning: No Step-Free alternative */}
          {hasNoStepFreeAlt && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-on-surface">No Step-Free Bypass on Current Corridor</h4>
                  <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                    {hazard.rerouteResult?.warnings?.[0] || 'Due to steep grade and structural blockade, direct alternative is impassable.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  speakText('Routing to nearest accessible entrance at South Concourse Gate 1.');
                  router.push('/gps-precision?dest=South+Concourse+Gate+1&autonav=1');
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-sm cursor-pointer"
              >
                <span>Find Nearest Accessible Entrance →</span>
              </button>
            </div>
          )}

          {/* Route Comparison Matrix */}
          <div className="flex flex-col gap-3 pt-2">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">
              Route Comparison: Original vs Adapted Step-Free Route
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Original Route (Blocked) */}
              <div className="p-5 rounded-2xl bg-error-container/10 border-2 border-error/30 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-error uppercase">Original Planned Route</span>
                    <XCircle className="w-5 h-5 text-error" />
                  </div>
                  <h4 className="font-extrabold text-base text-on-surface">
                    {originalTitle}
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    {hazard.originalRouteDetail || 'Direct concourse path. Elevator out of service due to maintenance. Stairs required as fallback (Not Step-Free).'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-error-container/20 text-on-error-container text-xs font-bold flex items-center gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0 text-error" />
                  <span>Blocked: Impassable barrier present on direct route</span>
                </div>
              </div>

              {/* Adapted Route (Active) */}
              <div className="p-5 rounded-2xl bg-secondary-container/20 border-2 border-secondary flex flex-col justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-secondary uppercase">Recommended Adapted Route</span>
                    <CheckCircle2 className="w-5 h-5 text-secondary" />
                  </div>
                  <h4 className="font-extrabold text-base text-on-surface">
                    {adaptedTitle}
                  </h4>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    {hazard.adaptedRouteDetail || 'Bypasses elevator hub via gentle 3.5% incline ramp and service lift. 100% Step-Free & WCAG AAA Verified.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-secondary text-on-secondary text-xs font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 text-white" />
                  <span>100% Step-Free &amp; Verified by Community Audits</span>
                </div>
              </div>

            </div>
          </div>

          {/* Synchronized Surface Filters Applied to Adapted Route */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span className="text-xs font-extrabold text-on-surface uppercase tracking-wider">
                  Surface Preferences Applied to Bypass
                </span>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant">
                Live Synced
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { key: 'avoidCobblestones' as const, label: 'No Cobblestones' },
                { key: 'avoidUnpavedGravel' as const, label: 'No Unpaved/Gravel' },
                { key: 'avoidSteepInclines' as const, label: 'Max 5% Incline' },
                { key: 'preferTactilePaving' as const, label: 'Tactile Ground Paving' },
                { key: 'preferSignalizedCrossings' as const, label: 'Signal Crossings' },
                { key: 'wellLitOnly' as const, label: 'Well-Lit Paths' },
              ].map(f => {
                const active = surfaceFilters[f.key];
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleSurfaceFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all border cursor-pointer ${
                      active
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}{f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-outline-variant/30">
            <button
              type="button"
              onClick={handleProceedToMap}
              className="flex-1 h-14 rounded-xl bg-secondary text-on-secondary font-bold text-base flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Accept &amp; Navigate Reroute</span>
            </button>

            <Link
              href="/community-confidence"
              className="px-6 h-14 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-sm text-on-surface flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Compass className="w-5 h-5 text-primary" />
              <span>Community Verification</span>
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}

export default function LiveAdaptationAlertPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-bold text-on-surface-variant">Loading Live Adaptation Alert...</div>}>
      <LiveAdaptationAlertContent />
    </Suspense>
  );
}
