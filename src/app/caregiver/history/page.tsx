'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  History,
  Navigation,
  Clock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Footprints,
} from 'lucide-react';

interface TripItem {
  id: string;
  source: string;
  destination: string;
  dependentName?: string;
  startedAt: string;
  completedAt?: string;
  durationMinutes: number;
  distanceMeters: number;
  status: 'COMPLETED' | 'CANCELLED' | string;
}

export default function CaregiverHistoryPage() {
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/guardian/dashboard');
      if (res.ok) {
        const data = await res.json();
        // Aggregated trips from dashboard or empty array
        const historyList: TripItem[] = data.tripHistory || [];
        setTrips(historyList);
      } else {
        setError('Failed to load activity history');
      }
    } catch {
      setError('Network error while loading trip history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const totalTrips = trips.length;
  const totalDistanceKm = trips.length > 0
    ? (trips.reduce((acc, t) => acc + (t.distanceMeters || 0), 0) / 1000).toFixed(1)
    : '0.0';
  const safeArrivalsRate = trips.length > 0
    ? Math.round((trips.filter(t => t.status === 'COMPLETED').length / trips.length) * 100)
    : 100;

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-black shadow-md">
              <History className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-on-surface tracking-tight">
                Activity History
              </h1>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                Completed trip logs, telemetry replays, and route safety records.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchTrips}
            aria-label="Refresh activity history"
            className="p-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Real Dynamic Aggregate Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-1">
            <span className="text-[11px] font-black text-on-surface-variant uppercase">Total Trips Completed</span>
            <span className="text-2xl font-black text-primary">{totalTrips} Trips</span>
          </div>

          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-1">
            <span className="text-[11px] font-black text-on-surface-variant uppercase">Step-Free Distance</span>
            <span className="text-2xl font-black text-secondary">{totalDistanceKm} km</span>
          </div>

          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-1">
            <span className="text-[11px] font-black text-on-surface-variant uppercase">Safe Arrivals Rate</span>
            <span className="text-2xl font-black text-emerald-600">{safeArrivalsRate}%</span>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 flex items-center gap-4 animate-pulse">
                <div className="w-11 h-11 rounded-2xl bg-surface-container-high" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="w-32 h-4 bg-surface-container-high rounded" />
                  <div className="w-56 h-3 bg-surface-container-high rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-5 rounded-3xl bg-error/10 border border-error/20 text-error flex items-center justify-between gap-3 text-xs font-bold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchTrips}
              className="px-3 py-1.5 rounded-xl bg-error text-white font-extrabold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && trips.length === 0 && (
          <div className="p-10 text-center flex flex-col items-center justify-center gap-3 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center font-black">
              <Footprints className="w-7 h-7" />
            </div>
            <h2 className="text-base font-black text-on-surface">No trip history recorded yet</h2>
            <p className="text-xs text-on-surface-variant max-w-sm">
              Completed navigation journeys and telemetry replays will automatically appear here.
            </p>
          </div>
        )}

        {/* Trips List */}
        {!loading && !error && trips.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-black text-on-surface uppercase tracking-wider">
              Past Navigation Journeys
            </h2>

            {trips.map(trip => (
              <div
                key={trip.id}
                className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center font-bold flex-shrink-0">
                    <Navigation className="w-5 h-5" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {trip.dependentName && (
                        <span className="text-xs font-black text-primary">{trip.dependentName}</span>
                      )}
                      <span className="text-[10px] text-on-surface-variant font-semibold">
                        • {new Date(trip.startedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-extrabold text-on-surface">
                      <span>{trip.source}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant" />
                      <span>{trip.destination}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-on-surface-variant pt-1">
                      <span className="flex items-center gap-1 font-bold">
                        <Clock className="w-3.5 h-3.5 text-secondary" />
                        {trip.durationMinutes} min
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        {(trip.distanceMeters / 1000).toFixed(1)} km
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/caregiver/map"
                  className="px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center gap-1.5 transition-colors self-end sm:self-center"
                >
                  <span>Replay on Map</span>
                </Link>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
