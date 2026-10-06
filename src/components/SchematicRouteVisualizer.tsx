'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Accessibility,
  Footprints,
  ShieldCheck,
  Zap,
  MapPin,
  Compass,
  ArrowRight
} from 'lucide-react';
import { SchematicStep } from '@/data/routeSimulatorData';

interface SchematicRouteVisualizerProps {
  startLocation: string;
  destLocation: string;
  normalSteps: SchematicStep[];
  accessibleSteps: SchematicStep[];
  isComparing: boolean;
  activeView: 'both' | 'normal' | 'accessible';
  onViewChange?: (view: 'both' | 'normal' | 'accessible') => void;
}

export default function SchematicRouteVisualizer({
  startLocation,
  destLocation,
  normalSteps,
  accessibleSteps,
  isComparing,
  activeView,
  onViewChange
}: SchematicRouteVisualizerProps) {
  const getStepIcon = (type: SchematicStep['type']) => {
    switch (type) {
      case 'stair':
        return <span className="font-mono text-xs font-black">⚠ Stairs</span>;
      case 'barrier':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'unsafe_crossing':
        return <Zap className="w-4 h-4 text-rose-500" />;
      case 'ramp':
        return <Accessibility className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'accessible_crossing':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'smooth_footpath':
        return <Footprints className="w-4 h-4 text-primary" />;
      default:
        return <MapPin className="w-4 h-4 text-on-surface-variant" />;
    }
  };

  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 md:p-8 shadow-md flex flex-col gap-6">
      
      {/* Header & Schematic Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black text-on-surface">
            Detailed Step-by-Step Breakdown
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-surface-container border border-outline-variant/40 text-on-surface-variant">
            Schematic Timeline — Detailed Steps
          </span>

          {onViewChange && (
            <div className="flex rounded-xl bg-surface-container-low p-1 border border-outline-variant/30 text-xs font-bold">
              <button
                type="button"
                onClick={() => onViewChange('both')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activeView === 'both'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Split Comparison
              </button>
              <button
                type="button"
                onClick={() => onViewChange('normal')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activeView === 'normal'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => onViewChange('accessible')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activeView === 'accessible'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Accessible
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Start and Destination Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant block">
              Origin
            </span>
            <span className="text-sm font-black text-on-surface">{startLocation}</span>
          </div>
        </div>

        <ArrowRight className="w-5 h-5 text-on-surface-variant hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant block">
              Destination
            </span>
            <span className="text-sm font-black text-on-surface">{destLocation}</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Schematic Layout */}
      <div className={`grid grid-cols-1 ${activeView === 'both' ? 'lg:grid-cols-2' : ''} gap-6`}>
        
        {/* NORMAL ROUTE SCHEMATIC */}
        {(activeView === 'both' || activeView === 'normal') && (
          <div className={`flex flex-col p-5 rounded-2xl border-2 transition-all ${
            isComparing ? 'opacity-80 scale-[0.99]' : ''
          } bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40`}>
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-rose-200/60 dark:border-rose-900/40">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-sm font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                  Normal Route Track
                </span>
              </div>
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-2.5 py-0.5 rounded-full">
                High Barrier Density
              </span>
            </div>

            {/* Timeline Tree */}
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-rose-300 dark:before:bg-rose-800">
              {/* Start */}
              <div className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  A
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-surface">Depart from {startLocation}</h4>
                  <p className="text-[11px] text-on-surface-variant">Default transit departure point</p>
                </div>
              </div>

              {/* Waypoints */}
              {normalSteps.map((step, idx) => (
                <div key={step.id || idx} className="relative flex items-start gap-3 group">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/80 border-2 border-rose-500 text-rose-600 dark:text-rose-300 flex items-center justify-center shadow-xs">
                    {getStepIcon(step.type)}
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-rose-200 dark:border-rose-900/40 shadow-2xs w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-rose-800 dark:text-rose-300">
                        {step.title}
                      </span>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                        {step.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}

              {/* Destination */}
              <div className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-rose-700 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  B
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-surface">Arrive at {destLocation}</h4>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
                    Shortest geometric distance (steeper gradient)
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ACCESSIBLE ROUTE SCHEMATIC */}
        {(activeView === 'both' || activeView === 'accessible') && (
          <div className={`flex flex-col p-5 rounded-2xl border-2 transition-all ${
            isComparing ? 'scale-[1.01] ring-2 ring-emerald-500/30' : ''
          } bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-800/40`}>
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-emerald-200/60 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Accessible Route Track
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                Step-Free & Compliant
              </span>
            </div>

            {/* Timeline Tree */}
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-emerald-400 dark:before:bg-emerald-700">
              {/* Start */}
              <div className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  A
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-surface">Depart via Step-Free Ramp at {startLocation}</h4>
                  <p className="text-[11px] text-on-surface-variant">Elevator/ramp concourse access</p>
                </div>
              </div>

              {/* Waypoints */}
              {accessibleSteps.map((step, idx) => (
                <div key={step.id || idx} className="relative flex items-start gap-3 group">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 border-2 border-emerald-600 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-xs">
                    {getStepIcon(step.type)}
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-emerald-200 dark:border-emerald-900/40 shadow-2xs w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                        {step.title}
                      </span>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                        {step.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}

              {/* Destination */}
              <div className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  B
                </div>
                <div>
                  <h4 className="text-xs font-bold text-on-surface">Safe Arrival at {destLocation}</h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                    Zero stairs encountered • Maximum slope ≤ 5%
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Visual Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-outline-variant/30 text-xs font-bold text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Normal Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Accessible Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black text-rose-600">⚠</span>
          <span>Stair Hazard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>Barrier Obstacle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Accessibility className="w-3.5 h-3.5 text-emerald-600" />
          <span>Accessible Ramp</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Controlled Crossing</span>
        </div>
      </div>

    </div>
  );
}
