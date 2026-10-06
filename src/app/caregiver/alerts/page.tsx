'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BellRing,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldAlert,
  Navigation,
  Check,
  Filter,
} from 'lucide-react';

interface AlertItem {
  id: string;
  type: 'SOS' | 'ROUTE_DEVIATION' | 'PROLONGED_STOP' | 'TRIP_STARTED' | 'TRIP_COMPLETED';
  childName: string;
  childEmail: string;
  message: string;
  timestamp: string;
  read: boolean;
  locationCoords?: { lat: number; lng: number };
}

export default function CaregiverAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 'alt_1',
      type: 'SOS',
      childName: 'Demo User (Dependent)',
      childEmail: 'demo.user@pathfinder.app',
      message: 'Emergency SOS panic alert triggered near CSMT Plaza.',
      timestamp: new Date().toISOString(),
      read: false,
      locationCoords: { lat: 18.9398, lng: 72.8355 },
    },
    {
      id: 'alt_2',
      type: 'TRIP_STARTED',
      childName: 'Alex Rivera',
      childEmail: 'alex.rivera@community.org',
      message: 'Alex Rivera started navigation to Shivaji Park Ground.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: true,
      locationCoords: { lat: 19.0760, lng: 72.8777 },
    },
    {
      id: 'alt_3',
      type: 'ROUTE_DEVIATION',
      childName: 'Alex Rivera',
      childEmail: 'alex.rivera@community.org',
      message: 'Detour warning: 45m departure from accessible wheelchair route.',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      read: true,
      locationCoords: { lat: 19.0750, lng: 72.8760 },
    },
  ]);

  const [filterType, setFilterType] = useState<string>('all');

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'all') return true;
    if (filterType === 'sos') return a.type === 'SOS';
    if (filterType === 'unread') return !a.read;
    return true;
  });

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-error text-on-error flex items-center justify-center font-black shadow-md">
              <BellRing className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-on-surface tracking-tight">
                Alerts &amp; SOS Log
              </h1>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                Emergency incidents, route departures, and trip safety updates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            className="px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Mark All as Read</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {['all', 'unread', 'sos'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterType(f)}
              className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs uppercase cursor-pointer transition-all ${
                filterType === f
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {f === 'all' ? 'All Alerts' : f === 'unread' ? 'Unread Only' : 'Emergency SOS'}
            </button>
          ))}
        </div>

        {/* Alerts Feed */}
        <div className="flex flex-col gap-3">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm font-medium bg-surface-container-lowest rounded-3xl border border-outline-variant/30">
              No alerts match your filter.
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs ${
                  alert.type === 'SOS'
                    ? 'bg-error/5 border-error/40 ring-1 ring-error/20'
                    : alert.read
                    ? 'bg-surface-container-lowest border-outline-variant/30'
                    : 'bg-primary-container/15 border-primary/40'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0 ${
                    alert.type === 'SOS'
                      ? 'bg-error text-on-error animate-pulse shadow-md'
                      : 'bg-surface-container-high text-primary'
                  }`}>
                    {alert.type === 'SOS' ? <AlertOctagon className="w-6 h-6" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-on-surface">
                        {alert.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        • {alert.childName}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-on-surface">{alert.message}</p>
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Link
                    href="/caregiver/map"
                    className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-black flex items-center gap-1.5 shadow-sm hover:opacity-95"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Track Map</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
