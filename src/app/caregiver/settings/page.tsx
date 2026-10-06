'use client';

import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  Bell,
  MapPin,
  Battery,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export default function CaregiverSettingsPage() {
  const [geofenceRadius, setGeofenceRadius] = useState<number>(200);
  const [batteryThreshold, setBatteryThreshold] = useState<number>(20);
  const [deviationAlerts, setDeviationAlerts] = useState<boolean>(true);
  const [stopAlerts, setStopAlerts] = useState<boolean>(true);
  const [sosSiren, setSosSiren] = useState<boolean>(true);
  const [saved, setSaved] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-black shadow-md">
            <Sliders className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-on-surface tracking-tight">
              Safe Zones &amp; Settings
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant font-medium">
              Configure geofences, alert thresholds, and automated safety guards.
            </p>
          </div>
        </div>

        {saved && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Guardian preferences and safe zones updated successfully.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* Safe Zones & Geofence Card */}
          <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-black text-on-surface">Geofence Safe Zone Buffer</h2>
                <p className="text-xs text-on-surface-variant">
                  Trigger an instant alert if dependent strays beyond this perimeter from destination.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-on-surface">
                <span>Safe Buffer Radius</span>
                <span className="text-primary">{geofenceRadius} meters</span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="50"
                value={geofenceRadius}
                onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Battery & Hardware Alerts */}
          <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
                <Battery className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-black text-on-surface">Low Battery Warning Threshold</h2>
                <p className="text-xs text-on-surface-variant">
                  Receive low battery warning when dependent’s mobile device drops below threshold.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-on-surface">
                <span>Alert Threshold</span>
                <span className="text-amber-600 dark:text-amber-400">{batteryThreshold}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={batteryThreshold}
                onChange={(e) => setBatteryThreshold(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Notification Toggles */}
          <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col gap-4">
            <h2 className="text-sm font-black text-on-surface uppercase tracking-wider">
              Safety Guard Notifications
            </h2>

            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-on-surface">Route Departure Alerts</span>
                  <span className="text-[11px] text-on-surface-variant">Notify when user departs &gt;50m from planned step-free path</span>
                </div>
                <input
                  type="checkbox"
                  checked={deviationAlerts}
                  onChange={(e) => setDeviationAlerts(e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-on-surface">Prolonged Inactivity Warning</span>
                  <span className="text-[11px] text-on-surface-variant">Notify when user remains stationary for &gt;5 minutes</span>
                </div>
                <input
                  type="checkbox"
                  checked={stopAlerts}
                  onChange={(e) => setStopAlerts(e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/20 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-xs font-extrabold text-on-surface">Audible Siren on SOS</span>
                  <span className="text-[11px] text-on-surface-variant">Play loud alarm sound when emergency panic is received</span>
                </div>
                <input
                  type="checkbox"
                  checked={sosSiren}
                  onChange={(e) => setSosSiren(e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-13 rounded-2xl bg-primary text-on-primary font-black text-sm shadow-md hover:opacity-95 transition-opacity cursor-pointer"
          >
            Save Guardian Settings
          </button>
        </form>

      </div>
    </div>
  );
}
