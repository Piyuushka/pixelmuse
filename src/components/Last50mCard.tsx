'use client';

import React, { useMemo } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import { Volume2, Navigation, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { entrances } from '@/data/entrances';
import { selectEntrance } from '@/lib/entranceSelector';
import { computeConfidence } from '@/lib/confidence';

export default function Last50mCard() {
  const { persona, speakText } = useAccessibility();

  // Mock user location near Building B for the purpose of the distance calculation
  const userLocation = { lat: 40.7126, lng: -74.0055 };

  const { recommended, avoided, reasoning } = useMemo(
    () => selectEntrance(entrances, persona, userLocation),
    [persona]
  );

  const confidence = recommended ? computeConfidence(recommended) : null;
  const daysAgo = useMemo(() => {
    if (!recommended?.lastVerified) return 0;
    return Math.floor((Date.now() - new Date(recommended.lastVerified).getTime()) / 86400000);
  }, [recommended]);

  const handleSpeak = () => {
    speakText(reasoning);
  };

  return (
    <div className="mt-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
        <span className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 fill-primary" />
          Last 50 m: Entrance Guidance
        </span>
      </div>

      {recommended ? (
        <div className="flex flex-col gap-2">
          {/* Recommended Entrance */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-extrabold text-on-surface">{recommended.name}</h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {recommended.stepFree && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white">
                    Step-Free
                  </span>
                )}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                  {recommended.doorType} door
                </span>
                {recommended.rampSlopePercent && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    {recommended.rampSlopePercent}% slope
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Confidence Info */}
          {confidence && (
            <div className="flex items-center gap-2 mt-1 px-2 py-1.5 rounded-lg bg-surface-container-highest/50 border border-outline-variant/20 text-[10px] text-on-surface-variant">
              <Info className="w-3 h-3 text-secondary" />
              <span>
                Confidence: <strong className="text-on-surface">{confidence.score}%</strong> 
                {' '}• Verified {daysAgo} days ago, {recommended.confirmations} confirmations
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm font-bold text-red-600">No verified accessible entrance found for your profile.</div>
      )}

      {/* Avoided */}
      {avoided.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/20">
          <span className="text-[11px] font-bold text-on-surface-variant">Avoided Entrances:</span>
          <div className="flex flex-wrap gap-1.5">
            {avoided.map((a, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-1 rounded-md">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span className="text-[10px] font-bold text-red-700">{a.entrance.name}</span>
                <span className="text-[10px] text-red-600/80 px-1 border-l border-red-200">
                  {a.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instruction & Speak */}
      <div
        className="flex items-center gap-3 p-3 rounded-xl bg-secondary-container/30 border border-secondary/20"
        aria-live="polite"
      >
        <p className="text-xs font-medium text-on-surface flex-1">
          {reasoning}
        </p>
        <button
          onClick={handleSpeak}
          className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-md hover:opacity-90 transition-opacity flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-secondary"
          aria-label="Speak instruction"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
