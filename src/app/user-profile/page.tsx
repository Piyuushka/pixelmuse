'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { ConsentScreen } from '@/components/ConsentScreen';
import {
  Navigation,
  Shield,
  RefreshCw,
  Unlink,
  User,
  Heart,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
} from 'lucide-react';

export default function UserProfilePage() {
  const { user, speakText } = useAccessibility();

  const [pairingCode, setPairingCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [pendingConsent, setPendingConsent] = useState<{ name: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPairingInfo = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/pairing/links');
      const data = await res.json();
      if (res.ok && data.success) {
        setPairingCode(data.pairingCode || '123456');
        setCaregivers(data.caregivers || []);
      }
    } catch (err) {
      console.error('Failed to fetch pairing links:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPairingInfo();
  }, []);

  const handleGenerateNewCode = async () => {
    try {
      const res = await fetch('/api/pairing/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setPairingCode(data.pairingCode);
        setExpiresAt(data.expiresAt);
        setMessage({ type: 'success', text: 'New 6-digit pairing code generated!' });
        speakText('New pairing code generated');
      } else {
        throw new Error(data.error || 'Failed to generate code');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate new code' });
    }
  };

  const handleRevoke = async (targetEmail: string) => {
    try {
      const res = await fetch('/api/pairing/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Caregiver linkage revoked.' });
        speakText('Caregiver access revoked.');
        fetchPairingInfo();
      } else {
        throw new Error(data.error || 'Failed to revoke link');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to revoke link' });
    }
  };

  const handleApproveConsent = async () => {
    if (!pendingConsent) return;
    try {
      const res = await fetch('/api/pairing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caregiverEmail: pendingConsent.email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Caregiver linkage approved.' });
        speakText('Consent granted and caregiver linked.');
        setPendingConsent(null);
        fetchPairingInfo();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Approval failed' });
    }
  };

  const handleRejectConsent = async () => {
    if (!pendingConsent) return;
    try {
      await fetch('/api/pairing/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: pendingConsent.email }),
      });
      setPendingConsent(null);
      setMessage({ type: 'success', text: 'Pairing request rejected.' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface p-6">
      {pendingConsent && (
        <ConsentScreen
          caregiverName={pendingConsent.name}
          caregiverEmail={pendingConsent.email}
          onApprove={handleApproveConsent}
          onReject={handleRejectConsent}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <Link href="/safety-routing" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Navigation
          </Link>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold">{user.name || 'User Profile'}</span>
          </div>
        </div>

        {/* Status Alert Messages */}
        {message && (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-error/10 text-error border border-error/20'
          }`}>
            <span>{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} className="text-xs underline">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Dynamic Pairing Code & QR */}
          <div className="p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl flex flex-col items-center text-center space-y-5">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-black text-on-surface">Your Pairing Code</h2>
            </div>
            <p className="text-xs text-on-surface-variant font-medium max-w-xs">
              Share this 6-digit code or QR code with your Caregiver to link accounts securely under DPDP guidelines.
            </p>

            {/* Big Code Display */}
            <div className="px-8 py-4 bg-surface-container border border-outline-variant/50 rounded-2xl text-3xl font-black tracking-widest text-primary font-mono shadow-inner">
              {pairingCode ? `${pairingCode.slice(0, 3)}-${pairingCode.slice(3)}` : '------'}
            </div>

            {/* QR Canvas */}
            <QRCodeDisplay text={pairingCode || 'PATHFINDER_PAIR'} size={160} />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateNewCode}
                className="px-4 py-2 bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Generate New Code
              </button>
            </div>
          </div>

          {/* Card 2: Active Linked Caregivers */}
          <div className="p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl space-y-5 flex flex-col">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-black text-on-surface">Active Caregivers</h2>
            </div>
            <p className="text-xs text-on-surface-variant font-medium">
              Caregivers listed below can view your active location during navigation trips and receive emergency SOS alerts.
            </p>

            <div className="flex-1 space-y-3">
              {caregivers.length === 0 ? (
                <div className="p-6 bg-surface-container rounded-2xl border border-dashed border-outline-variant/50 text-center space-y-2">
                  <Heart className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
                  <p className="text-xs font-semibold text-on-surface-variant">No Caregivers currently linked.</p>
                  <p className="text-[11px] text-on-surface-variant/70">Share your 6-digit pairing code above with a caregiver.</p>
                </div>
              ) : (
                caregivers.map((cg) => (
                  <div key={cg.id || cg.email} className="p-4 rounded-2xl border border-outline-variant/40 bg-surface flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-on-surface">{cg.name || 'Caregiver'}</h3>
                      <p className="text-[11px] text-on-surface-variant">{cg.email}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary mt-1">
                        <CheckCircle2 className="w-3 h-3" /> DPDP Consent Active
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(cg.email)}
                      className="p-2 rounded-xl bg-error/10 hover:bg-error/20 text-error font-bold text-xs flex items-center gap-1 border border-error/20"
                    >
                      <Unlink className="w-3.5 h-3.5" /> Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
