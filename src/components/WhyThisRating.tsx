'use client';

import React, { useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  X,
  Layers,
  HelpCircle,
  Activity,
  Flame,
} from 'lucide-react';
import { TrustResult } from '@/lib/trust';

export interface WhyThisRatingProps {
  trustResult: TrustResult;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  itemId?: string;
}

export default function WhyThisRating({
  trustResult,
  isOpen,
  onClose,
  title = 'Accessibility Trust Rating Breakdown',
  itemId,
}: WhyThisRatingProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const levelColorMap = {
    high: 'text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-amber-800 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
    low: 'text-rose-800 dark:text-rose-300 bg-rose-500/10 border-rose-500/30',
  };

  const LevelIcon =
    trustResult.level === 'high'
      ? ShieldCheck
      : trustResult.level === 'medium'
        ? ShieldAlert
        : AlertTriangle;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trust-rating-title"
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="region"
        aria-label="Trust Calculation Audit"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface-container-lowest text-on-surface rounded-3xl border border-outline-variant/50 shadow-2xl overflow-hidden flex flex-col gap-0 animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="p-5 md:p-6 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${levelColorMap[trustResult.level]}`}>
              <LevelIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 id="trust-rating-title" className="text-base font-black text-on-surface leading-tight">
                {title}
              </h3>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Continuous decay & consensus audit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
            aria-label="Close rating breakdown"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 flex flex-col gap-5 overflow-y-auto max-h-[75vh]">
          {/* Trust Score Header Banner */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                Composite Trust Score
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-black text-on-surface">
                  {trustResult.score}
                </span>
                <span className="text-xs font-bold text-on-surface-variant">
                  / 100
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${levelColorMap[trustResult.level]}`}>
                <LevelIcon className="w-3.5 h-3.5" />
                <span>{trustResult.level.toUpperCase()} TRUST</span>
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant">
                {trustResult.freshnessLabel}
              </span>
            </div>
          </div>

          {/* Mathematical Point Breakdown */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-black uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              Scoring Factors & Points Attribution
            </h4>

            <div className="flex flex-col gap-2">
              {trustResult.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-start justify-between gap-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black text-on-surface">
                      {item.label}
                    </span>
                    {item.detail && (
                      <p className="text-[11px] font-medium text-on-surface-variant leading-relaxed">
                        {item.detail}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md shrink-0 ${
                      item.value > 0
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                        : item.value < 0
                          ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300'
                          : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {item.value > 0 ? `+${item.value}` : item.value} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Continuous Exponential Decay Panel */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 via-surface-container-low to-surface-container border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-on-surface">
                Continuous Time Decay Engine
              </span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
              Unlike arbitrary time buckets, PathFinder uses exponential half-life decay:{' '}
              <code className="px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-[11px] text-primary">
                D(t) = 0.5^(t / t_half)
              </code>
              . Dynamic hazards (flooding) decay in hours, while structural ramps decay over months.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-outline-variant/20">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant">Category Half-Life</span>
                <span className="font-black text-on-surface mt-0.5">
                  {trustResult.halfLifeHours < 24
                    ? `${trustResult.halfLifeHours} Hours (Fleeting Hazard)`
                    : `${Math.round(trustResult.halfLifeHours / 24)} Days (Civil Infrastructure)`}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant">Remaining Decay Weight</span>
                <span className="font-black text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {(trustResult.decayFactor * 100).toFixed(1)}% fresh
                </span>
              </div>
            </div>
          </div>

          {/* Audit Timestamps & Next Review Due */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-secondary shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">Last Verified</span>
                <time dateTime={trustResult.lastUpdated.toISOString()} className="font-extrabold text-on-surface">
                  {trustResult.formattedTimestamp}
                </time>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">Next Review Due</span>
                <time dateTime={trustResult.nextReviewDue.toISOString()} className="font-extrabold text-on-surface">
                  {trustResult.nextReviewDue.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </time>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container text-xs font-black transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
