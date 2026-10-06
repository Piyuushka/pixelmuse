'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Users,
  Unlink,
  ArrowLeft,
} from 'lucide-react';

export default function CaregiverPairingPage() {
  const router = useRouter();
  const { speakText } = useAccessibility();

  const [pairingCode, setPairingCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dependents, setDependents] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDependents = async () => {
    try {
      const res = await fetch('/api/pairing/links');
      const data = await res.json();
      if (res.ok && data.success) {
        setDependents(data.dependents || []);
      }
    } catch (err) {
      console.error('Failed to fetch linked dependents:', err);
    }
  };

  useEffect(() => {
    fetchDependents();
  }, []);

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingCode || pairingCode.length < 6) {
      setMessage({ type: 'error', text: 'Please enter a valid 6-digit pairing code.' });
      return;
    }
    setMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/pairing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify pairing code');

      setMessage({ type: 'success', text: `Successfully paired with ${data.dependent?.name || 'Dependent'}!` });
      speakText(`Successfully paired with ${data.dependent?.name || 'Dependent'}`);
      setPairingCode('');
      fetchDependents();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Pairing failed. Please check code.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (targetEmail: string) => {
    try {
      const res = await fetch('/api/pairing/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Unlinked dependent account.' });
        fetchDependents();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to unlink' });
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Navigation Link */}
        <div className="flex items-center justify-between">
          <Link href="/caregiver-dashboard" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Return to Caregiver Dashboard
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Caregiver Module</span>
          </div>
        </div>

        {/* Pairing Form Card */}
        <div className="p-8 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-on-surface">Link Dependent Account</h1>
              <p className="text-xs text-on-surface-variant font-medium">
                Enter the 6-digit code shown on your dependent&apos;s PathFinder profile page.
              </p>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-error/10 text-error border border-error/20'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handlePairSubmit} className="space-y-4">
            <div>
              <label htmlFor="caregiver-pairing-code" className="block text-xs font-extrabold text-on-surface mb-1">
                6-Digit Pairing Code
              </label>
              <input
                id="caregiver-pairing-code"
                type="text"
                maxLength={6}
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full h-14 text-center tracking-widest text-2xl font-black rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || pairingCode.length < 6}
              className="w-full h-13 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verifying Code...' : 'Verify & Link Dependent'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Linked Dependents List */}
        <div className="p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-on-surface">Your Linked Dependents ({dependents.length})</h2>
          </div>

          <div className="space-y-3">
            {dependents.length === 0 ? (
              <p className="text-xs text-on-surface-variant font-medium py-4 text-center">
                No dependents currently linked to your caregiver account.
              </p>
            ) : (
              dependents.map((dep) => (
                <div key={dep.id || dep.email} className="p-4 rounded-2xl border border-outline-variant/40 bg-surface flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-on-surface">{dep.name}</h3>
                    <p className="text-[11px] text-on-surface-variant">{dep.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/caregiver-dashboard"
                      className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20"
                    >
                      Track Live
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleUnlink(dep.email)}
                      className="p-1.5 rounded-xl bg-error/10 text-error hover:bg-error/20"
                      title="Unlink Account"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
