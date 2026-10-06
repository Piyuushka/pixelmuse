'use client';

import React from 'react';
import { ShieldCheck, Calendar, Navigation, AlertTriangle, Printer } from 'lucide-react';

interface DailyStat {
  day: string;
  trips: number;
  distanceKm: number;
  score: number;
}

interface WeeklyReport {
  period: string;
  generatedAt: string;
  dependentName: string;
  totalTripsCompleted: number;
  totalDistanceKm: number;
  averageSafetyScore: number;
  totalAlertsTriggered: number;
  sosEventsCount: number;
  geofenceViolationsCount: number;
  dailyBreakdown: DailyStat[];
}

export function WeeklySummary({ report }: { report: WeeklyReport }) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl space-y-6 text-on-surface print:shadow-none print:border-none">
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-on-surface">Weekly Safety Summary Report</h2>
            <p className="text-xs text-on-surface-variant font-medium">{report.period} • {report.dependentName}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center gap-1.5 border border-outline-variant/40 print:hidden"
        >
          <Printer className="w-3.5 h-3.5 text-primary" /> Print / Export PDF
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Trips Completed</span>
          <p className="text-xl font-black text-primary">{report.totalTripsCompleted}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Total Distance</span>
          <p className="text-xl font-black text-primary">{report.totalDistanceKm} km</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Avg Safety Score</span>
          <p className="text-xl font-black text-emerald-600">{report.averageSafetyScore}/100</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Alerts Triggered</span>
          <p className="text-xl font-black text-amber-600">{report.totalAlertsTriggered}</p>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">7-Day Trip Activity</h3>
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant/30">
              <tr>
                <th className="p-3">Day</th>
                <th className="p-3">Trips</th>
                <th className="p-3">Distance</th>
                <th className="p-3">Safety Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {report.dailyBreakdown.map((row) => (
                <tr key={row.day} className="hover:bg-surface-container-low/50 font-medium">
                  <td className="p-3 font-bold">{row.day}</td>
                  <td className="p-3">{row.trips} trips</td>
                  <td className="p-3">{row.distanceKm} km</td>
                  <td className="p-3 font-bold text-emerald-600">{row.score}/100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
