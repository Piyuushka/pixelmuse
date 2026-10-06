'use client';

import React, { useState, useEffect } from 'react';
import CaregiverSidebar from '@/components/CaregiverSidebar';
import { useDependentTracking } from '@/hooks/useDependentTracking';
import { AlertOctagon, PhoneCall, CheckCircle, Navigation, ShieldAlert, Volume2 } from 'lucide-react';
import Link from 'next/link';

export default function CaregiverPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeSOS, acknowledgeSOS, resolveSOS } = useDependentTracking();
  const [sirenPlaying, setSirenPlaying] = useState(false);

  useEffect(() => {
    if (activeSOS && activeSOS.status === 'TRIGGERED') {
      setSirenPlaying(true);
    } else {
      setSirenPlaying(false);
    }
  }, [activeSOS]);

  return (
    <div className="flex w-full min-h-screen bg-surface text-on-surface relative">
      <CaregiverSidebar />
      
      <main className="flex-1 min-w-0 overflow-y-auto min-h-screen relative">
        {/* GLOBAL CRITICAL SOS ALERT BANNER */}
        {activeSOS && (
          <div className="sticky top-0 z-50 w-full p-4 bg-error text-on-error shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-bounce-short border-b-4 border-white/40">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white text-error flex items-center justify-center font-black animate-pulse flex-shrink-0 shadow-lg">
                <AlertOctagon className="w-7 h-7 fill-current" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-black uppercase tracking-wider">
                    EMERGENCY SOS ALERT: {activeSOS.userName || activeSOS.userEmail}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white text-error font-extrabold uppercase">
                    {activeSOS.status}
                  </span>
                </div>
                <p className="text-xs text-on-error/90 font-semibold">
                  {activeSOS.message || 'Panic alarm triggered. Immediate guardian intervention needed.'} • Coords: {activeSOS.lat.toFixed(4)}, {activeSOS.lng.toFixed(4)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Link
                href="/caregiver/map"
                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-white text-error font-black text-xs flex items-center justify-center gap-1.5 shadow-md hover:bg-white/90 transition-all"
              >
                <Navigation className="w-4 h-4" />
                <span>Track on Map</span>
              </Link>
              
              {activeSOS.status === 'TRIGGERED' && (
                <button
                  type="button"
                  onClick={acknowledgeSOS}
                  className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-black/30 hover:bg-black/40 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-white/30"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Acknowledge</span>
                </button>
              )}

              <button
                type="button"
                onClick={resolveSOS}
                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Resolved</span>
              </button>
            </div>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
