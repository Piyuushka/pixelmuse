'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { TrustResult, TrustableItem, computeTrust } from '@/lib/trust';
import WhyThisRating from './WhyThisRating';

export interface TrustBadgeProps {
  item?: TrustableItem;
  trustResult?: TrustResult;
  size?: 'sm' | 'md' | 'lg';
  showFreshness?: boolean;
  showWhyButton?: boolean;
  className?: string;
  exactTimestamp?: string;
}

export default function TrustBadge({
  item,
  trustResult: explicitTrust,
  size = 'md',
  showFreshness = true,
  showWhyButton = true,
  className = '',
  exactTimestamp,
}: TrustBadgeProps) {
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  // Compute trust if not explicitly passed
  const trust: TrustResult = useMemo(() => {
    if (explicitTrust) return explicitTrust;
    if (item) return computeTrust(item);
    return computeTrust({
      source: 'Community',
      lastVerified: new Date(),
      confirmations: 5,
    });
  }, [explicitTrust, item]);

  const levelStyles = {
    high: {
      border: 'border-emerald-500/40 dark:border-emerald-500/50',
      bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
      text: 'text-emerald-900 dark:text-emerald-200',
      icon: ShieldCheck,
      iconColor: 'text-emerald-700 dark:text-emerald-300',
      label: 'High Trust',
    },
    medium: {
      border: 'border-amber-500/40 dark:border-amber-500/50',
      bg: 'bg-amber-500/10 dark:bg-amber-950/40',
      text: 'text-amber-950 dark:text-amber-200',
      icon: ShieldAlert,
      iconColor: 'text-amber-700 dark:text-amber-300',
      label: 'Medium Trust',
    },
    low: {
      border: 'border-rose-500/40 dark:border-rose-500/50',
      bg: 'bg-rose-500/10 dark:bg-rose-950/40',
      text: 'text-rose-950 dark:text-rose-200',
      icon: AlertTriangle,
      iconColor: 'text-rose-700 dark:text-rose-300',
      label: 'Low Trust',
    },
  }[trust.level];

  const IconComp = levelStyles.icon;

  const sizeClasses = {
    sm: 'text-[10px] py-0.5 px-2 gap-1 rounded-lg',
    md: 'text-xs py-1 px-2.5 gap-1.5 rounded-xl',
    lg: 'text-sm py-1.5 px-3.5 gap-2 rounded-2xl',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const displayTimestamp = exactTimestamp || trust.formattedTimestamp;

  return (
    <>
      <div className={`inline-flex items-center flex-wrap gap-1.5 ${className}`}>
        {/* Main Trust Badge */}
        <div
          className={`inline-flex items-center border font-extrabold transition-all select-none ${levelStyles.border} ${levelStyles.bg} ${levelStyles.text} ${sizeClasses}`}
          title={`${levelStyles.label}: ${trust.score}/100 • Source: ${trust.sourceType} • Last updated: ${displayTimestamp}`}
          aria-label={`${levelStyles.label}, score ${trust.score} out of 100`}
        >
          <IconComp className={`${iconSizes} ${levelStyles.iconColor} shrink-0`} />
          <span className="font-black">{trust.score}%</span>
          <span className="opacity-90">{levelStyles.label}</span>
        </div>

        {/* Freshness Label with Accessible Hover/Focus Tooltip for exact timestamp */}
        {showFreshness && (
          <time
            dateTime={trust.lastUpdated.toISOString()}
            tabIndex={0}
            title={`Exact Audit Timestamp: ${displayTimestamp}`}
            className="group relative inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary rounded-md px-1 py-0.5 cursor-help"
            aria-label={`Last updated ${trust.timeAgoText}. Exact time: ${displayTimestamp}`}
          >
            <Clock className="w-3 h-3 text-secondary shrink-0" />
            <span>Last updated {trust.timeAgoText}</span>

            {/* Custom high-contrast tooltip on hover/focus */}
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex group-focus:flex flex-col items-center z-50 whitespace-nowrap"
            >
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-extrabold shadow-lg border border-slate-700">
                {displayTimestamp}
              </span>
              <span className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
            </span>
          </time>
        )}

        {/* Why this rating button */}
        {showWhyButton && (
          <button
            type="button"
            onClick={() => setIsWhyOpen(true)}
            aria-expanded={isWhyOpen}
            aria-label={`Why ${trust.score}% trust rating? Open detailed explanation`}
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary-container hover:underline px-1.5 py-0.5 rounded-md focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3 h-3 shrink-0" />
            <span>Why?</span>
          </button>
        )}
      </div>

      {/* Accessible Modal Dialog for breakdown */}
      <WhyThisRating
        trustResult={trust}
        isOpen={isWhyOpen}
        onClose={() => setIsWhyOpen(false)}
        title={item?.title || item?.name || 'Item Trust Breakdown'}
        itemId={item?.id}
      />
    </>
  );
}
