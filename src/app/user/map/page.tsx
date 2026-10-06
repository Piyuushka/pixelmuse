'use client';

import React, { Suspense } from 'react';
import UnifiedRoutePlanner from '@/components/UnifiedRoutePlanner';
import { useLocationSharing } from '@/hooks/useLocationSharing';
import { Play, Pause, Radio, ShieldCheck } from 'lucide-react';

function UserMapContent() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const { isSimulating, toggleSimulation, isSharing, battery, lastPingAt } = useLocationSharing(true);

  return (
    <div className="relative w-full h-full">
      {/* Floating Simulation Controls (Render ONLY when DEMO_MODE=true) */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {isDemoMode && (
          <button
            type="button"
            onClick={toggleSimulation}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl border transition-all cursor-pointer ${
              isSimulating
                ? 'bg-secondary text-on-secondary border-secondary animate-pulse ring-2 ring-secondary/40'
                : 'bg-surface-container-lowest/90 backdrop-blur-md text-on-surface border-outline-variant/40 hover:bg-surface-container-high'
            }`}
            title="Simulate walking coordinates"
          >
            {isSimulating ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Simulating Movement</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-primary" />
                <span>Simulate Movement</span>
              </>
            )}
          </button>
        )}

        {/* Real Live Broadcast Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/40 shadow-md">
          <div className={`w-2 h-2 rounded-full ${isSharing || isSimulating ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
          <span className="text-[10px] font-extrabold text-on-surface uppercase">
            {isSharing || isSimulating ? 'GPS Live' : 'GPS Standby'}
          </span>
          {battery !== null && battery !== undefined && (
            <span className="text-[10px] font-black text-on-surface-variant">
              {battery}% 🔋
            </span>
          )}
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
