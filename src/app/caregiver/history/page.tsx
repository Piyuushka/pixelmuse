'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  History,
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  Calendar,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface TripItem {
  id: string;
  source: string;
  destination: string;
  dependentName: string;
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
  distanceMeters: number;
  status: 'COMPLETED' | 'CANCELLED';
}

const DEMO_TRIPS: TripItem[] = [
  {
    id: 't1',
    dependentName: 'Demo User (Dependent)',
    source: 'Chhatrapati Shivaji Maharaj Terminus',
    destination: 'Marine Drive Concourse Gate 3',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 1800000).toISOString(),
    durationMinutes: 30,
    distanceMeters: 2400,
    status: 'COMPLETED',
  },
  {
    id: 't2',
    dependentName: 'Alex Rivera',
    source: 'Dadar Station South Concourse',
    destination: 'Cardiology Pavilion - Level 3',
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 86400000 + 1200000).toISOString(),
    durationMinutes: 20,
    distanceMeters: 1450,
    status: 'COMPLETED',
  },
  {
    id: 't3',
    dependentName: 'Alex Rivera',
    source: 'Bandra West Junction',
    destination: 'BKC Concourse Plaza',
    startedAt: new Date(Date.now() - 172800000).toISOString(),
    completedAt: new Date(Date.now() - 172800000 + 1800000).toISOString(),
    durationMinutes: 30,
    distanceMeters: 2800,
    status: 'COMPLETED',
  },
];

export default function CaregiverHistoryPage() {
  const [trips] = useState<TripItem[]>(DEMO_TRIPS);

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
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

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-1">
            <span className="text-[11px] font-black text-on-surface-variant uppercase">Total Trips Completed</span>
            <span className="text-2xl font-black text-primary">24 Trips</span>
          </div>

          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-1">
            <span className="text-[11px] font-black text-on-surface-variant uppercase">Step-Free Distance</span>
            <span className="text-2xl font-black text-secondary">38.4 km</span>
          </div>

          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col gap-1">
            <span className="text-[11px] font-black text-on-surface-variant uppercase">Safe Arrivals Rate</span>
            <span className="text-2xl font-black text-emerald-600">100%</span>
          </div>
        </div>

        {/* Trips List */}
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
                    <span className="text-xs font-black text-primary">{trip.dependentName}</span>
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

      </div>
    </div>
  );
}
