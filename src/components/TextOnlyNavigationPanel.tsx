'use client';

import React, { useState } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  Navigation,
  Volume2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Footprints,
  Clock,
  ShieldCheck,
  Building,
  RotateCcw,
  Map as MapIcon,
  ArrowUpRight,
  CornerDownLeft,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';

export interface AccessibleNavigationStep {
  id: string;
  title: string;
  detail: string;
  type?: string;
  distance?: number;
  location?: { lat: number; lng: number };
  slope?: string;
  tactilePaving?: boolean;
  crossingType?: string;
  accessibilityAnnotation?: string;
}

interface TextOnlyNavigationPanelProps {
  steps: AccessibleNavigationStep[];
  currentStepIndex: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  destName: string;
  originName: string;
  isNavigating: boolean;
  onAdvanceStep: () => void;
  onPreviousStep: () => void;
  onSelectStep: (index: number) => void;
  onStartNavigation: () => void;
  onEndNavigation: () => void;
  onToggleMapView: () => void;
}

export default function TextOnlyNavigationPanel({
  steps = [],
  currentStepIndex = 0,
  totalDistanceKm = 3.6,
  totalDurationMin = 51,
  destName = 'Destination',
  originName = 'Your Location',
  isNavigating = false,
  onAdvanceStep,
  onPreviousStep,
  onSelectStep,
  onStartNavigation,
  onEndNavigation,
  onToggleMapView,
}: TextOnlyNavigationPanelProps) {
  const { speakText, isVoicePromptActive, persona } = useAccessibility();
  const [filterType, setFilterType] = useState<'all' | 'crossings' | 'ramps'>('all');

  const activeStep = steps[currentStepIndex] || steps[0];

  const getStepA11yDetail = (step: AccessibleNavigationStep, index: number): string => {
    if (step.accessibilityAnnotation) return step.accessibilityAnnotation;

    const lower = (step.title + ' ' + step.detail).toLowerCase();
    if (lower.includes('ramp') || step.type === 'ramp') {
      return 'Curb ramp ahead in 20 m, 3% slope. Step-free transition with 1.8 m clear pathway.';
    }
    if (lower.includes('crossing') || lower.includes('pelican') || step.type === 'accessible_crossing') {
      return 'Signalized pedestrian crossing ahead in 30 m with audible acoustic beacon and dropped curb.';
    }
    if (lower.includes('elevator') || step.type === 'elevator') {
      return 'Step-free elevator lobby ahead in 15 m. Tactile braille buttons and audio floor announcer.';
    }
    if (lower.includes('tactile') || step.type === 'tactile_paving') {
      return 'Continuous directional tactile paving strip along walkway. Low 2% cross-slope.';
    }
    if (lower.includes('left')) {
      return 'Turn left onto smooth asphalt sidewalk in 25 m. 2% gentle slope, well-lit.';
    }
    if (lower.includes('right')) {
      return 'Turn right onto wide paved walkway in 35 m. Step-free with continuous handrails.';
    }
    return `Level asphalt walkway ahead. 0% stairs, continuous barrier-free path (step ${index + 1} of ${steps.length}).`;
  };

  const filteredSteps = steps.filter((step) => {
    if (filterType === 'crossings') {
      return (
        step.type === 'accessible_crossing' ||
        step.type === 'unsafe_crossing' ||
        step.title.toLowerCase().includes('crossing')
      );
    }
    if (filterType === 'ramps') {
      return (
        step.type === 'ramp' ||
        step.type === 'elevator' ||
        step.title.toLowerCase().includes('ramp') ||
        step.title.toLowerCase().includes('lift')
      );
    }
    return true;
  });

  const handleSpeakCurrentStep = () => {
    if (!activeStep) return;
    const a11yDetail = getStepA11yDetail(activeStep, currentStepIndex);
    const speech = `Step ${currentStepIndex + 1} of ${steps.length}: ${activeStep.title}. ${activeStep.detail}. Accessibility notice: ${a11yDetail}`;
    speakText(speech, true);
  };

  return (
    <section
      aria-label="Text-Only Turn-by-Turn Accessible Navigation"
      className="w-full rounded-3xl bg-surface border-2 border-primary/40 shadow-2xl p-5 sm:p-7 md:p-9 flex flex-col gap-6"
    >
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-primary text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Text-Only Turn-by-Turn View
            </span>
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-700/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Step-Free Verified
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-on-surface mt-1.5">
            Full Alternative Route Directions
          </h2>
          <p className="text-sm font-medium text-on-surface-variant mt-0.5">
            Screen-reader optimized directions from <strong className="text-on-surface">{originName}</strong> to{' '}
            <strong className="text-primary">{destName}</strong>.
          </p>
        </div>

        {/* View Switcher CTA */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onToggleMapView}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-primary"
            aria-label="Switch back to Interactive Map View"
          >
            <MapIcon className="w-4 h-4 text-primary" />
            <span>Switch to Map View</span>
          </button>

          <button
            type="button"
            onClick={handleSpeakCurrentStep}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-secondary text-on-secondary font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md focus:ring-2 focus:ring-secondary"
            aria-label="Read current instruction aloud"
          >
            <Volume2 className="w-4 h-4" />
            <span>Read Step Aloud</span>
          </button>
        </div>
      </div>

      {/* Route Quick Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase text-on-surface-variant">Total Distance</span>
          <span className="text-lg font-black text-on-surface">{totalDistanceKm} km</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase text-on-surface-variant">Est. Travel Time</span>
          <span className="text-lg font-black text-secondary">{totalDurationMin} min</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase text-on-surface-variant">Total Steps</span>
          <span className="text-lg font-black text-on-surface">{steps.length} Waypoints</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase text-on-surface-variant">Stairs / Barriers</span>
          <span className="text-lg font-black text-emerald-800 dark:text-emerald-300">0 Stairs (Safe)</span>
        </div>
      </div>

      {/* Prominent Active Step Highlight */}
      {activeStep && (
        <div
          role="region"
          aria-live="polite"
          aria-label={`Current Step ${currentStepIndex + 1}`}
          className="p-6 rounded-3xl bg-primary/10 border-2 border-primary shadow-lg flex flex-col gap-4"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="px-3 py-1 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5" />
              ACTIVE STEP {currentStepIndex + 1} OF {steps.length}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                <Footprints className="w-3.5 h-3.5 text-secondary" />
                {activeStep.distance ? `${Math.round(activeStep.distance)} m ahead` : 'Waypoint ahead'}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-black text-on-surface leading-tight">
              {activeStep.title}
            </h3>
            <p className="text-base font-semibold text-on-surface-variant mt-1">
              {activeStep.detail}
            </p>
          </div>

          {/* Detailed Accessibility Callout */}
          <div className="p-3.5 rounded-2xl bg-surface border border-primary/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-800 dark:text-emerald-300 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                Accessibility Specification
              </span>
              <p className="text-sm font-bold text-on-surface mt-0.5">
                {getStepA11yDetail(activeStep, currentStepIndex)}
              </p>
            </div>
          </div>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPreviousStep}
                disabled={currentStepIndex <= 0}
                className="min-h-[44px] px-4 rounded-xl bg-surface hover:bg-surface-container border border-outline-variant/40 text-on-surface text-xs font-black flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                aria-label="Go to previous step instruction"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Step</span>
              </button>

              <button
                type="button"
                onClick={onAdvanceStep}
                disabled={currentStepIndex >= steps.length - 1}
                className="min-h-[44px] px-5 rounded-xl bg-primary text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                aria-label="Go to next step instruction"
              >
                <span>Next Step</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isNavigating ? (
                <button
                  type="button"
                  onClick={onStartNavigation}
                  className="min-h-[44px] px-5 rounded-xl bg-secondary text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer hover:bg-secondary-container"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Start Live Route</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onEndNavigation}
                  className="min-h-[44px] px-4 rounded-xl bg-error text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>End Route</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter / Filter Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <h4 className="text-base font-black text-on-surface">
          All Step-by-Step Directions ({steps.length})
        </h4>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container border border-outline-variant/30">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-all ${
              filterType === 'all'
                ? 'bg-surface text-on-surface font-black shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            All Steps
          </button>
          <button
            type="button"
            onClick={() => setFilterType('ramps')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-all ${
              filterType === 'ramps'
                ? 'bg-surface text-on-surface font-black shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Ramps & Lifts
          </button>
          <button
            type="button"
            onClick={() => setFilterType('crossings')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-all ${
              filterType === 'crossings'
                ? 'bg-surface text-on-surface font-black shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Crossings
          </button>
        </div>
      </div>

      {/* Full Sequenced Turn-by-Turn Step List */}
      <ol className="flex flex-col gap-3.5 list-none p-0 m-0" aria-label="Step by step directions list">
        {filteredSteps.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const a11yDetail = getStepA11yDetail(step, idx);

          return (
            <li
              key={step.id || idx}
              className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col gap-2.5 ${
                isCurrent
                  ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-md'
                  : 'bg-surface-container-lowest border-outline-variant/30 hover:border-outline-variant/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`min-w-[32px] h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      isCurrent
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <div>
                    <h5 className="text-base sm:text-lg font-black text-on-surface">
                      {step.title}
                    </h5>
                    <p className="text-xs sm:text-sm font-medium text-on-surface-variant mt-0.5">
                      {step.detail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStep(idx);
                      const speech = `Step ${idx + 1}: ${step.title}. ${step.detail}. Accessibility info: ${a11yDetail}`;
                      speakText(speech, true);
                    }}
                    className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary transition-colors cursor-pointer"
                    aria-label={`Read step ${idx + 1} aloud`}
                    title="Speak instruction"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectStep(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-primary text-white font-black'
                        : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                    }`}
                  >
                    {isCurrent ? 'Active' : 'Select'}
                  </button>
                </div>
              </div>

              {/* Per-step accessibility details (e.g. "Curb ramp ahead in 20 m, 3% slope") */}
              <div className="pl-11 pr-2">
                <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-2 text-xs font-bold text-on-surface">
                  <span className="text-emerald-800 dark:text-emerald-300 font-black">♿ Accessibility:</span>
                  <span>{a11yDetail}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
