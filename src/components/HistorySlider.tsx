'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import type { LocationPing } from '@/lib/locationCache';

interface HistorySliderProps {
  pings: LocationPing[];
  onSelectPing: (ping: LocationPing | null) => void;
}

export function HistorySlider({ pings, onSelectPing }: HistorySliderProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(pings.length - 1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    setCurrentIndex(pings.length - 1);
  }, [pings.length]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && pings.length > 0) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= pings.length - 1) {
            setIsPlaying(false);
            return pings.length - 1;
          }
          const next = prev + 1;
          onSelectPing(pings[next]);
          return next;
        });
      }, 800);
    }
    return () => clearInterval(timer);
  }, [isPlaying, pings, onSelectPing]);

  if (pings.length === 0) {
    return null;
  }

  const currentPing = pings[currentIndex] || pings[pings.length - 1];
  const formattedTime = currentPing
    ? new Date(currentPing.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--';

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setCurrentIndex(val);
    onSelectPing(pings[val] || null);
  };

  const togglePlay = () => {
    if (currentIndex >= pings.length - 1) {
      setCurrentIndex(0);
      onSelectPing(pings[0]);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="p-4 bg-slate-900/90 text-white border border-slate-700/60 rounded-2xl shadow-2xl backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>24h History Playback</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[11px]">
            {formattedTime}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentIndex(pings.length - 1);
              onSelectPing(null);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            title="Reset to Live"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={pings.length - 1}
        value={currentIndex}
        onChange={handleSliderChange}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}
