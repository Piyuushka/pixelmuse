'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Siren, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface SOSPanicButtonProps {
  onTrigger: (isTestMode?: boolean) => void;
  isTestMode?: boolean;
}

export function SOSPanicButton({ onTrigger, isTestMode = false }: SOSPanicButtonProps) {
  const [holdingProgress, setHoldingProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [triggered, setTriggered] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    setIsHolding(true);
    let current = 0;
    timerRef.current = setInterval(() => {
      current += 5;
      setHoldingProgress(current);
      if (current >= 100) {
        clearInterval(timerRef.current!);
        setIsHolding(false);
        setTriggered(true);
        // Haptic feedback if available on mobile
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }
        onTrigger(isTestMode);
      }
    }, 50); // 50ms * 20 = 1000ms * 3 = 3 seconds hold
  };

  const endHold = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsHolding(false);
    setHoldingProgress(0);
  };

  // Shake gesture detection for mobile accessibility
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastTime = Date.now();

    const handleMotion = (e: DeviceMotionEvent) => {
      const current = e.accelerationIncludingGravity;
      if (!current) return;
      const now = Date.now();
      if (now - lastTime > 100) {
        const diffTime = now - lastTime;
        lastTime = now;
        const speed = (Math.abs((current.x || 0) + (current.y || 0) + (current.z || 0) - lastX - lastY - lastZ) / diffTime) * 10000;
        if (speed > 800) {
          onTrigger(isTestMode);
        }
        lastX = current.x || 0;
        lastY = current.y || 0;
        lastZ = current.z || 0;
      }
    };

    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
    }
    return () => {
      if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleMotion);
      }
    };
  }, [onTrigger, isTestMode]);

  return (
    <div className="flex flex-col items-center gap-3">
      {isTestMode && (
        <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[11px] font-black tracking-wider uppercase">
          [TEST MODE - SAFE]
        </span>
      )}

      <button
        type="button"
        onMouseDown={startHold}
        onMouseUp={endHold}
        onTouchStart={startHold}
        onTouchEnd={endHold}
        className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center font-black text-white shadow-2xl transition-transform active:scale-95 cursor-pointer select-none ${
          triggered
            ? 'bg-red-700 ring-8 ring-red-500/50'
            : isTestMode
            ? 'bg-amber-600 hover:bg-amber-500 ring-8 ring-amber-500/30'
            : 'bg-red-600 hover:bg-red-500 ring-8 ring-red-500/30'
        }`}
        aria-label="Hold for 3 seconds to trigger emergency SOS panic alert"
      >
        {/* Hold Progress Circle Overlay */}
        {isHolding && (
          <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeDasharray="289"
              strokeDashoffset={289 - (289 * holdingProgress) / 100}
              className="transition-all duration-75"
            />
          </svg>
        )}

        {triggered ? (
          <>
            <CheckCircle2 className="w-12 h-12 mb-1 animate-bounce" />
            <span className="text-xs font-black uppercase">SOS Triggered</span>
          </>
        ) : (
          <>
            <Siren className="w-12 h-12 mb-1 animate-pulse" />
            <span className="text-sm font-black uppercase tracking-wider">
              {isHolding ? 'Hold 3s...' : 'EMERGENCY SOS'}
            </span>
            <span className="text-[10px] opacity-80 font-medium">
              {isHolding ? `${Math.round((holdingProgress / 100) * 3)}s` : 'Press & Hold'}
            </span>
          </>
        )}
      </button>

      <p className="text-xs text-on-surface-variant font-medium text-center max-w-xs">
        {isTestMode
          ? 'Test mode records alert in system without dispatching SMS or calling 112.'
          : 'Hold for 3 seconds or shake device firmly to dispatch live SOS to Caregivers.'}
      </p>
    </div>
  );
}
