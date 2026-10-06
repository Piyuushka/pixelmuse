'use client';

import React, { useState } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import { RouteFormValues } from './RoutePlannerForm';
import {
  MapPin,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Compass,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  Info,
  Footprints,
  Accessibility,
  Eye,
  Heart,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

interface MainMapInterfaceProps {
  formValues: RouteFormValues;
  onEditRoute: () => void;
  onStartTour: () => void;
}

export default function MainMapInterface({
  formValues,
  onEditRoute,
  onStartTour,
}: MainMapInterfaceProps) {
  const { speakText, isHighContrast } = useAccessibility();
  const [activeTab, setActiveTab] = useState<'turn' | 'barriers' | 'elevation'>('turn');
  const [selectedHazard, setSelectedHazard] = useState<string | null>(null);

  const personaIcons: Record<string, React.ElementType> = {
    wheelchair: Accessibility,
    'older-adult': Footprints,
    'low-vision': Eye,
    caregiver: Heart,
    none: Navigation,
  };
  const PersonaIcon = personaIcons[formValues.persona] || Accessibility;

  return (
    <main
      className="min-h-[calc(100vh-65px)] w-full bg-slate-900 text-white relative overflow-hidden flex flex-col md:flex-row"
      aria-label="Main Map Navigation Interface"
    >
      {/* Left / Floating Overlay Panel: Route Details Card */}
      <aside
        id="route-details-card"
        className="w-full md:w-[420px] lg:w-[460px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 flex flex-col justify-between shrink-0 shadow-2xl border-r border-purple-100 dark:border-purple-900/40 z-20 overflow-y-auto max-h-screen"
        aria-label="Calculated Accessible Route Details"
      >
        <div className="space-y-5">
          
          {/* Header & Status */}
          <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/40 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Active Navigation
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-purple-50 truncate mt-0.5 max-w-[260px]">
                {formValues.destination}
              </h1>
            </div>

            <button
              onClick={() => {
                speakText("Opening route preferences edit form");
                onEditRoute();
              }}
              className="px-3 py-1.5 rounded-full bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Modify</span>
            </button>
          </div>

          {/* Persona & Form Preference Summary Badge */}
          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <PersonaIcon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-purple-300">
                    Travel Mode
                  </div>
                  <div className="text-sm font-extrabold text-purple-950 dark:text-purple-100 capitalize">
                    {formValues.persona.replace('-', ' ')}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-slate-500 dark:text-purple-300">
                  Max Slope
                </div>
                <div className="text-sm font-extrabold text-purple-700 dark:text-purple-300">
                  ≤ {formValues.maxSlope}% Slope
                </div>
              </div>
            </div>

            {/* Active Preference Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formValues.preferences.stepFree && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Step-Free
                </span>
              )}
              {formValues.preferences.lowSlope && (
                <span className="px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Low Slope
                </span>
              )}
              {formValues.preferences.wellLit && (
                <span className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  Well-Lit
                </span>
              )}
              {formValues.preferences.saferCrossings && (
                <span className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-bold">
                  Safer Crossings
                </span>
              )}
            </div>
          </div>

          {/* Route Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="text-xs font-bold text-slate-400">Est. Time</div>
              <div className="text-lg font-black text-purple-700 dark:text-purple-300">6 min</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="text-xs font-bold text-slate-400">Distance</div>
              <div className="text-lg font-black text-slate-800 dark:text-slate-100">420 m</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="text-xs font-bold text-slate-400">Safety Score</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">99%</div>
            </div>
          </div>

          {/* Step-by-Step Directions */}
          <div className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Navigation Steps
            </h2>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-50/70 dark:bg-slate-800 border border-purple-200 dark:border-slate-700">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-slate-900 dark:text-purple-100">
                      Depart Main Plaza via West Tactile Path
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      98% Trust • 📷 Proof
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-purple-300 mt-0.5">
                    Smooth asphalt surface, slope &lt; 2%. Tactile pavement present.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-slate-900 dark:text-purple-100">
                      Take Elevator B to Level 2 Junction (Lift)
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      96% Trust • 📷 Proof
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-purple-300 mt-0.5">
                    Braille buttons + voice announcement active. Photo-verified cabin dimensions.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-slate-900 dark:text-purple-100">
                      Arrive at Cardiology Dept Reception
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                      99% Verified
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-purple-300 mt-0.5">
                    Automatic 110cm double sliding doors with low counter access.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Start Tour Quick Link */}
        <div className="pt-4 border-t border-purple-100 dark:border-purple-900/40 mt-4">
          <button
            onClick={onStartTour}
            className="w-full py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-purple-900/20 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Launch Interactive Guided Tour</span>
          </button>
        </div>
      </aside>

      {/* Right: Map Visualization Area */}
      <section
        className="flex-1 relative bg-slate-950 flex flex-col items-center justify-center min-h-[450px] p-4 sm:p-8"
        aria-label="Interactive Map Visualization Canvas"
      >
        {/* Map Grid Canvas Graphic */}
        <div className="w-full h-full max-w-4xl max-h-[600px] bg-slate-900 rounded-3xl border border-slate-800 relative shadow-2xl overflow-hidden flex flex-col justify-between p-6">
          
          {/* Map Top Bar Controls */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 text-xs font-bold text-purple-300">
              <Compass className="w-4 h-4 text-purple-400 animate-spin-slow" aria-hidden="true" />
              <span>Live Accessible Route Canvas</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 text-xs font-bold border border-emerald-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live GPS Sync
              </span>
            </div>
          </div>

          {/* SVG Map Path & Waypoints Visualization */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <svg
              className="w-full h-full max-w-2xl max-h-96"
              viewBox="0 0 600 350"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background Grid Lines */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Accessible Route Path Line */}
              <path
                d="M 80 280 C 180 280, 220 180, 320 180 C 400 180, 440 90, 520 90"
                stroke="#7c3aed"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="1 0"
              />
              <path
                d="M 80 280 C 180 280, 220 180, 320 180 C 400 180, 440 90, 520 90"
                stroke="#a855f7"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8 8"
                className="animate-[dash_20s_linear_infinite]"
              />

              {/* Start Node */}
              <g transform="translate(80, 280)">
                <circle r="16" fill="#7c3aed" fillOpacity="0.3" />
                <circle r="10" fill="#7c3aed" />
                <circle r="4" fill="#ffffff" />
                <text x="0" y="32" textAnchor="middle" fill="#e2e8f0" fontSize="12" fontWeight="bold">
                  Start: Main Entrance
                </text>
              </g>

              {/* Waypoint 1 - Step Free Ramp */}
              <g transform="translate(220, 210)">
                <circle r="8" fill="#10b981" />
                <text x="14" y="4" fill="#6ee7b7" fontSize="11" fontWeight="bold">
                  Step-Free Ramp (2.8% slope)
                </text>
              </g>

              {/* Destination Node */}
              <g transform="translate(520, 90)">
                <circle r="18" fill="#7c3aed" fillOpacity="0.3" className="animate-ping" />
                <circle r="12" fill="#6d28d9" />
                <text x="0" y="-22" textAnchor="middle" fill="#c084fc" fontSize="13" fontWeight="extrabold">
                  Cardiology Dept
                </text>
              </g>
            </svg>
          </div>

          {/* Live Adaptation Alert Icon on Map (Spotlight Tour Target #3) */}
          <div
            id="map-hazard-alert"
            className="absolute top-1/3 right-1/4 z-30 flex flex-col items-center"
          >
            <button
              type="button"
              onClick={() => {
                const msg = "Live Adaptation Alert: West Elevator under emergency maintenance. Rerouting active via South Ramp C.";
                setSelectedHazard(msg);
                speakText(msg);
              }}
              aria-label="Live Adaptation Hazard Alert. Elevator outage detected."
              className="relative p-3 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/40 animate-bounce focus:outline-none focus:ring-4 focus:ring-amber-300"
            >
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full border-2 border-slate-900" />
            </button>
            <span className="mt-1 text-[11px] font-extrabold bg-amber-950/90 text-amber-200 px-2 py-0.5 rounded-md border border-amber-500/40">
              Live Reroute Alert
            </span>
          </div>

          {/* Live Adaptation Alert Card Overlay */}
          {selectedHazard && (
            <div className="absolute bottom-6 left-6 right-6 z-40 bg-amber-950/95 border-2 border-amber-500 text-amber-100 rounded-2xl p-4 shadow-2xl flex items-start justify-between gap-3 backdrop-blur-md">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-sm text-amber-300">
                    Live Real-Time Hazard Reroute
                  </div>
                  <p className="text-xs text-amber-100/90 mt-1 font-medium">
                    {selectedHazard}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHazard(null)}
                className="text-xs font-bold px-2 py-1 bg-amber-900 hover:bg-amber-800 text-amber-200 rounded-lg"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Map Footer Info */}
          <div className="z-10 flex items-center justify-between text-xs text-slate-400 bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>WCAG AAA Accessible Routing Engine</span>
            </div>
            <div className="font-mono text-purple-300">
              Gradient: {formValues.maxSlope}% max limit respected
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
