'use client';

import React from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

export default function UserAlertsPage() {
  const { simulatedObstacle, toggleSimulatedObstacle, speakText } = useAccessibility();

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-[850px] flex flex-col gap-6">
        
        {/* Title */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-tertiary text-on-tertiary flex items-center justify-center shadow-md">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-on-surface tracking-tight">
              Live Adaptation Alert
            </h1>
            <p className="text-on-surface-variant text-sm font-medium">
              Real-time obstacle detector & automatic accessible rerouting system.
            </p>
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
                <span className="text-xs font-bold text-tertiary uppercase tracking-wider">
                  Active Hazard Warning
                </span>
                <h2 className="text-xl font-extrabold text-on-surface">
                  {simulatedObstacle.title}
                </h2>
              </div>
            </div>

            <button
              onClick={() => {
                toggleSimulatedObstacle();
                speakText(
                  simulatedObstacle.active
                    ? 'Hazard cleared. Returning to standard accessible route.'
                    : 'Obstacle detected ahead. Calculating step-free detour.'
                );
              }}
              className="px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-bold transition-colors flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{simulatedObstacle.active ? 'Clear Obstacle' : 'Simulate Obstacle'}</span>
            </button>
          </div>

          {/* Status Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
              <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold">
                <MapPin className="w-4 h-4 text-primary" />
                <span>Location</span>
              </div>
              <span className="text-sm font-extrabold text-on-surface">
                {simulatedObstacle.location}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
              <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold">
                <Clock className="w-4 h-4 text-secondary" />
                <span>Impact on ETA</span>
              </div>
              <span className="text-sm font-extrabold text-on-surface">
                +2 min Detour Time
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
              <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Accessibility Safety</span>
              </div>
              <span className="text-sm font-extrabold text-on-surface">
                100% Step-Free Detour
              </span>
            </div>
          </div>

          {/* Comparison Cards: Blocked vs Detour */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Blocked Path */}
            <div className="p-5 rounded-2xl bg-error/5 border border-error/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-error uppercase tracking-wider">
                  Blocked Primary Route
                </span>
                <XCircle className="w-5 h-5 text-error" />
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {simulatedObstacle.impact || 'Broken elevator mechanism detected on pedestrian overpass. 12 steps required.'}
              </p>
              <div className="text-xs font-bold text-error">
                Hazard: Broken lift mechanism • 12 steps required
              </div>
            </div>

            {/* Detour Route */}
            <div className="p-5 rounded-2xl bg-secondary/10 border border-secondary/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-secondary uppercase tracking-wider">
                  Verified Accessible Detour
                </span>
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Step-free surface concourse detour with tactile paving guidance and 4.2% gentle incline.
              </p>
              <div className="text-xs font-bold text-secondary">
                Feature: Continuous ramp • 4.2% grade • Tactile paving
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/user/map"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity"
            >
              <span>Accept Detour & Navigate</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <span className="text-xs text-on-surface-variant font-medium text-center sm:text-right">
              Live reroute verified against municipal accessibility database.
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
