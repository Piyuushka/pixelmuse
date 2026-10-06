'use client';

import React, { Suspense } from 'react';
import UnifiedRoutePlanner from '@/components/UnifiedRoutePlanner';
import { useLocationSharing } from '@/hooks/useLocationSharing';
import { Play, Pause, Radio, ShieldCheck, Footprints } from 'lucide-react';

function UserMapContent() {
  const { isSimulating, toggleSimulation, isSharing, battery, lastPingAt } = useLocationSharing(true);

  return (
    <div className="relative w-full h-full">
      {/* Floating Demo Movement Simulator Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSimulation}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl border transition-all cursor-pointer ${
            isSimulating
              ? 'bg-secondary text-on-secondary border-secondary animate-pulse ring-2 ring-secondary/40'
              : 'bg-surface-container-lowest/90 backdrop-blur-md text-on-surface border-outline-variant/40 hover:bg-surface-container-high'
          }`}
          title="Simulates walking along Mumbai streets, streaming live coordinates to caregiver phone"
        >
          {isSimulating ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Simulating Walk (Active)</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current text-primary" />
              <span>Simulate Movement (Demo)</span>
            </>
          )}
        </button>

        {/* Live Broadcast Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/40 shadow-md">
          <div className={`w-2 h-2 rounded-full ${isSharing || isSimulating ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
          <span className="text-[10px] font-extrabold text-on-surface uppercase">
            {isSimulating ? 'Sim Stream' : isSharing ? 'Live GPS Stream' : 'Stream Paused'}
          </span>
          <span className="text-[10px] font-black text-on-surface-variant">
            {battery}% 🔋
          </span>
        </div>
      </div>

      <UnifiedRoutePlanner initialMode="gps" />
    </div>
  );
}

export default function UserMapPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-on-surface-variant font-medium">Loading Map...</div>}>
      <UserMapContent />
    </Suspense>
  );
}
