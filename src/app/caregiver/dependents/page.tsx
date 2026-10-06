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
  RefreshCw,
} from 'lucide-react';

interface DependentItem {
  id?: string;
  name: string;
  email: string;
  pairingCode?: string;
  status: 'ACCEPTED' | 'PENDING' | 'REVOKED' | string;
  lastPing?: string;
}

export default function CaregiverDependentsPage() {
  const [dependents, setDependents] = useState<DependentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [codeDigits, setCodeDigits] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [unlinkingEmail, setUnlinkingEmail] = useState<string | null>(null);

  const fetchDependents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/guardian/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDependents(data.dependents || []);
      } else {
        setError('Failed to load linked dependents');
      }
    } catch {
      setError('Network error while loading dependents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependents();
  }, []);

  const handleAddDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanCode = codeDigits.replace(/\D/g, '');
    if (cleanCode.length < 6) {
      setErrorMsg('Please enter a valid 6-digit pairing code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pairing/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify pairing code');

      setSuccessMsg(`Connection request sent to ${data.dependent?.name || 'Dependent'}. Waiting for approval on their phone.`);
      setCodeDigits('');
      fetchDependents();
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMsg('');
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error verifying code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (email: string) => {
    if (!confirm(`Are you sure you want to unlink ${email}?`)) return;
    setUnlinkingEmail(email);
    try {
      const res = await fetch('/api/guardian/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependentEmail: email }),
      });
      if (res.ok) {
        await fetchDependents();
      }
    } catch {
      // Quiet fallback
    } finally {
      setUnlinkingEmail(null);
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
                Manage linked family members and accounts paired for safety tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={fetchDependents}
              aria-label="Refresh dependents"
              className="p-3 rounded-2xl bg-surface-container-high hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Dependent by Code</span>
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 flex flex-col gap-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-high" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="w-24 h-4 bg-surface-container-high rounded" />
                    <div className="w-40 h-3 bg-surface-container-high rounded" />
                  </div>
                </div>
                <div className="w-full h-10 bg-surface-container-high rounded-xl" />
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
              onClick={fetchDependents}
              className="px-3 py-1.5 rounded-xl bg-error text-white font-extrabold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && dependents.length === 0 && (
          <div className="p-10 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 text-center flex flex-col items-center justify-center gap-4 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-secondary/15 text-secondary flex items-center justify-center font-black">
              <Users className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h2 className="text-xl font-black text-on-surface">No dependents linked yet</h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Add one with a pairing code to begin monitoring live coordinates, battery levels, and safety status.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 rounded-2xl bg-primary text-on-primary text-xs font-black shadow-md hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Dependent by Code</span>
            </button>
          </div>
        )}

        {/* Dependents Grid */}
        {!loading && dependents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dependents.map(dep => (
              <div
                key={dep.email}
                className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-md flex flex-col justify-between gap-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center font-black text-base shadow-sm flex-shrink-0">
                      {dep.name ? dep.name.charAt(0).toUpperCase() : 'D'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-base font-black text-on-surface truncate">{dep.name}</span>
                      <span className="text-xs text-on-surface-variant truncate">{dep.email}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                    dep.status === 'ONLINE' || dep.status === 'ACCEPTED'
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {dep.status || 'LINKED'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-on-surface-variant font-bold">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Telemetry Status</span>
                  </div>
                  <span className="font-extrabold text-on-surface">
                    {dep.lastPing ? dep.lastPing : 'Active'}
                  </span>
                </div>

                <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
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

                  <button
                    type="button"
                    onClick={() => handleUnlink(dep.email)}
                    disabled={unlinkingEmail === dep.email}
                    title="Unlink dependent"
                    aria-label={`Unlink ${dep.name}`}
                    className="p-2 rounded-xl bg-surface-container-high hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD DEPENDENT MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl p-6 md:p-8 flex flex-col gap-5 relative">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
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
                  <p className="text-xs text-on-surface-variant">Enter the 6-digit code shown on the dependent&apos;s phone</p>
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
                    maxLength={8}
                    inputMode="numeric"
                    placeholder="Enter 6-digit code"
                    value={codeDigits}
                    onChange={(e) => setCodeDigits(e.target.value)}
                    className="w-full h-12 px-4 text-center tracking-widest text-xl font-bold font-mono rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-[11px] text-on-surface-variant">
                    Ask the dependent to open &quot;Share My Location&quot; on their app to display their 6-digit code.
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
