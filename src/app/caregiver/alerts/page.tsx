'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BellRing,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Navigation,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Radio,
} from 'lucide-react';

interface AlertItem {
  id: string;
  type: 'SOS' | 'ROUTE_DEVIATION' | 'PROLONGED_STOP' | 'TRIP_STARTED' | 'TRIP_COMPLETED' | string;
  childName?: string;
  childEmail?: string;
  message: string;
  timestamp: string;
  read: boolean;
  isTest?: boolean;
  locationCoords?: { lat: number; lng: number };
}

export default function CaregiverAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      } else {
        setError('Failed to fetch alert history');
      }
    } catch {
      setError('Network error while fetching alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const markAllRead = async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    try {
      await fetch('/api/alerts/mark-all-read', { method: 'POST' }).catch(() => {});
    } catch {
      // Quiet fallback
    }
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

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={fetchAlerts}
              aria-label="Refresh alerts"
              className="p-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {alerts.some(a => !a.read) && (
              <button
                type="button"
                onClick={markAllRead}
                className="px-4 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Mark All as Read</span>
              </button>
            )}
          </div>
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

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-4 animate-pulse">
                <div className="w-11 h-11 rounded-2xl bg-surface-container-high" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="w-32 h-3.5 bg-surface-container-high rounded" />
                  <div className="w-64 h-3 bg-surface-container-high rounded" />
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
              onClick={fetchAlerts}
              className="px-3 py-1.5 rounded-xl bg-error text-white font-extrabold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && alerts.length === 0 && (
          <div className="p-10 text-center flex flex-col items-center justify-center gap-3 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-black">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-base font-black text-on-surface">No safety alerts recorded</h2>
            <p className="text-xs text-on-surface-variant max-w-sm">
              All linked dependents are secure and following designated safe paths.
            </p>
          </div>
        )}

        {/* Alerts Feed */}
        {!loading && !error && alerts.length > 0 && (
          <div className="flex flex-col gap-3">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm font-medium bg-surface-container-lowest rounded-3xl border border-outline-variant/30">
                No alerts match your filter.
              </div>
            ) : (
              filteredAlerts.map(alert => {
                const isSOS = alert.type === 'SOS';
                const isTestAlert = Boolean(alert.isTest || alert.message?.includes('[TEST') || alert.message?.includes('test'));

                return (
                  <div
                    key={alert.id}
                    className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs ${
                      isSOS && !isTestAlert
                        ? 'bg-error/10 border-error ring-1 ring-error/30'
                        : isTestAlert
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : alert.read
                        ? 'bg-surface-container-lowest border-outline-variant/30'
                        : 'bg-primary-container/15 border-primary/40'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black flex-shrink-0 ${
                        isSOS && !isTestAlert
                          ? 'bg-error text-on-error animate-pulse shadow-md'
                          : isTestAlert
                          ? 'bg-amber-500 text-white'
                          : 'bg-surface-container-high text-primary'
                      }`}>
                        {isSOS ? <AlertOctagon className="w-6 h-6" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          {isTestAlert ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white tracking-wider">
                              TEST ALERT
                            </span>
                          ) : isSOS ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-error text-on-error tracking-wider">
                              EMERGENCY SOS
                            </span>
                          ) : (
                            <span className="text-xs font-black uppercase tracking-wider text-on-surface">
                              {alert.type.replace(/_/g, ' ')}
                            </span>
                          )}
                          {alert.childName && (
                            <span className="text-[11px] text-on-surface-variant font-medium">
                              • {alert.childName}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-on-surface">{alert.message}</p>
                        
                        {isTestAlert && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                            Simulated drill — no external emergency services contacted.
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant pt-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
