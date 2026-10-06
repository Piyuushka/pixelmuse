'use client';

import React from 'react';
import { Battery, ShieldAlert, Signal } from 'lucide-react';

interface DependentMapMarkerProps {
  name: string;
  battery?: number; // 0-100
  accuracy?: number; // meters
  isSosActive?: boolean;
  statusLabel?: string;
  onClick?: () => void;
}

export function DependentMapMarker({
  name,
  battery = 85,
  accuracy = 4,
  isSosActive = false,
  statusLabel = 'Navigating',
  onClick,
}: DependentMapMarkerProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'DP';

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center group cursor-pointer select-none"
    >
      {/* SOS Pulse Halo */}
      {isSosActive && (
        <span className="absolute -inset-4 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
      )}

      {/* Info Card Tooltip on Hover */}
      <div className="mb-2 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-[11px] font-bold shadow-xl border border-slate-700 flex items-center gap-2 backdrop-blur-sm whitespace-nowrap">
        <span className={`w-2 h-2 rounded-full ${isSosActive ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
        <span>{name}</span>
        <div className="flex items-center gap-1 text-[10px] text-slate-300 border-l border-slate-700 pl-2">
          <Battery className="w-3 h-3 text-emerald-400" />
          <span>{battery}%</span>
        </div>
      </div>

      {/* Main Avatar Marker Circle */}
      <div
        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-sm shadow-2xl transition-transform group-hover:scale-110 ${
          isSosActive
            ? 'bg-red-600 border-white text-white ring-4 ring-red-500/50'
            : 'bg-indigo-600 border-white text-white ring-4 ring-indigo-500/30'
        }`}
      >
        {isSosActive ? <ShieldAlert className="w-6 h-6 animate-bounce" /> : initials}
      </div>

      {/* Marker Pointer Needle */}
      <div className={`w-3 h-3 rotate-45 -mt-1.5 border-r border-b ${isSosActive ? 'bg-red-600 border-white' : 'bg-indigo-600 border-white'}`} />
    </div>
  );
}
