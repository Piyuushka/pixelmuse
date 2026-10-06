'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  PlusCircle,
  UserCheck,
  ShieldCheck,
  MapPin,
  Clock,
  Radio,
  Unlink,
  Navigation,
  AlertCircle,
  CheckCircle2,
  X,
  QrCode,
} from 'lucide-react';

interface DependentItem {
  id: string;
  name: string;
  email: string;
  pairingCode?: string;
  status: 'ACCEPTED' | 'PENDING' | 'REVOKED';
  lastPing?: string;
}

export default function CaregiverDependentsPage() {
  const [dependents, setDependents] = useState<DependentItem[]>([
    {
      id: 'usr_demo_user',
      name: 'Demo User (Dependent)',
      email: 'demo.user@pathfinder.app',
      pairingCode: '852-963',
      status: 'ACCEPTED',
      lastPing: 'Active Now',
    },
    {
      id: 'usr_demo_1',
      name: 'Alex Rivera',
      email: 'alex.rivera@community.org',
      pairingCode: '492-817',
      status: 'ACCEPTED',
      lastPing: '10m ago',
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [codeDigits, setCodeDigits] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAddDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!codeDigits || codeDigits.trim().length < 6) {
      setErrorMsg('Please enter a valid 6-digit pairing code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pairing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode: codeDigits.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify pairing code');

      setSuccessMsg(`Connection request sent to ${data.dependent?.name || 'Dependent'}. Waiting for their approval on Phone A.`);
      setCodeDigits('');
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-black shadow-md">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-on-surface tracking-tight">
                My Dependents
              </h1>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                Manage linked family members and dependents paired for live tracking.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Dependent by Code</span>
          </button>
        </div>

        {/* Dependents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dependents.map(dep => (
            <div
              key={dep.email}
              className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-md flex flex-col justify-between gap-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center font-black text-base shadow-sm">
                    {dep.name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-black text-on-surface">{dep.name}</span>
                    <span className="text-xs text-on-surface-variant">{dep.email}</span>
                  </div>
                </div>

                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 uppercase">
                  {dep.status}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-on-surface-variant font-bold">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Telemetry Status</span>
                </div>
                <span className="font-extrabold text-on-surface">{dep.lastPing || 'Active Live'}</span>
              </div>

              <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                <Link
                  href="/caregiver/map"
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-black flex items-center gap-1.5 shadow-sm hover:opacity-95"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Live Track</span>
                </Link>

                <Link
                  href="/caregiver/history"
                  className="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-bold"
                >
                  View Trips
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ADD DEPENDENT MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl p-6 md:p-8 flex flex-col gap-5 relative">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-full bg-surface-container-high hover:bg-surface-container text-on-surface-variant cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-on-surface">Add Dependent</h3>
                  <p className="text-xs text-on-surface-variant">Enter the 6-digit code shown on Phone A</p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-error/10 text-error text-xs font-bold border border-error/20 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/30 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleAddDependent} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-on-surface">6-Digit Pairing Code</label>
                  <input
                    type="text"
                    maxLength={7}
                    placeholder="852-963 or 852963"
                    value={codeDigits}
                    onChange={(e) => setCodeDigits(e.target.value)}
                    className="w-full h-12 px-4 text-center tracking-widest text-xl font-bold font-mono rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-[11px] text-on-surface-variant">
                    Ask the dependent to open &quot;Share My Location&quot; on their phone to get the code.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Verifying Code...' : 'Connect to Dependent'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
