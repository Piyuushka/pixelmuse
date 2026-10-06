'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import {
  Share2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  User,
  Heart,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Radio,
  Lock,
  Pause,
  Play,
  Unlink,
} from 'lucide-react';

interface PendingRequest {
  linkId: string;
  guardianEmail: string;
  guardianName: string;
  createdAt: string;
}

export default function UserShareLocationPage() {
  const { user, speakText } = useAccessibility();

  const [pairingCode, setPairingCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [timeLeftSec, setTimeLeftSec] = useState<number>(600);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeGuardian, setActiveGuardian] = useState<string | null>(null);
  const [isSharingPaused, setIsSharingPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch pairing info and pending consent requests
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pairing/consent-status');
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
        } else {
          // If no code exists, generate one
          const genRes = await fetch('/api/pairing/code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.email }),
          });
          if (genRes.ok) {
            const genData = await genRes.json();
            if (genData.code) setPairingCode(genData.code);
          }
        }
        if (data.pairingCodeExpiresAt) {
          setExpiresAt(data.pairingCodeExpiresAt);
          const diff = Math.max(0, Math.floor((new Date(data.pairingCodeExpiresAt).getTime() - Date.now()) / 1000));
          setTimeLeftSec(diff);
        }
        setPendingRequests(data.pendingRequests || []);
        setActiveGuardian(data.activeGuardian || null);
      }
    } catch (err) {
      console.error('Error polling consent status:', err);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds for real-time caregiver connection request
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Countdown timer for pairing code
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSec(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Regenerate pairing code
  const handleRegenerateCode = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/pairing/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setPairingCode(data.pairingCode);
        setExpiresAt(data.expiresAt);
        setTimeLeftSec(600);
        setStatusMessage({ type: 'success', text: 'New 6-digit pairing code generated.' });
        speakText('New 6 digit pairing code generated.');
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to generate new code.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Respond to pending consent
  const handleConsentResponse = async (linkId: string, action: 'accept' | 'reject') => {
    try {
      const res = await fetch('/api/pairing/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: action === 'accept' ? 'Pairing accepted! Caregiver can now track your live route.' : 'Pairing request rejected.',
        });
        speakText(action === 'accept' ? 'Location sharing granted' : 'Request rejected');
        fetchStatus();
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to submit response.' });
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-[850px] flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center font-black shadow-md">
            <Share2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-on-surface tracking-tight">
              Share My Location
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant font-medium">
              Pair securely with a parent or caregiver for live two-phone safety monitoring.
            </p>
          </div>
        </div>

        {/* PENDING CONSENT REQUEST PROMPT MODAL / BANNER */}
        {pendingRequests.length > 0 && (
          <div className="p-6 rounded-3xl bg-secondary text-on-secondary shadow-2xl flex flex-col gap-4 border-2 border-white/40 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-secondary flex items-center justify-center font-black flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-wider">
                  Caregiver Connection Request
                </span>
                <span className="text-xs opacity-90 font-medium">
                  A caregiver entered your pairing code and is requesting permission to view your live GPS location.
                </span>
              </div>
            </div>

            {pendingRequests.map(req => (
              <div key={req.linkId} className="p-4 rounded-2xl bg-black/20 flex flex-col sm:flex-row items-center justify-between gap-3 border border-white/20">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-white">{req.guardianName}</span>
                  <span className="text-xs text-white/80">{req.guardianEmail}</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleConsentResponse(req.linkId, 'accept')}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white text-secondary font-black text-xs shadow-md hover:bg-white/90 transition-all cursor-pointer"
                  >
                    Allow & Share Location
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConsentResponse(req.linkId, 'reject')}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-black/40 hover:bg-black/60 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {statusMessage && (
          <div className={`p-4 rounded-2xl border flex items-center gap-2 font-bold text-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : 'bg-error/10 text-error border-error/30'
          }`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Current Active Connection Status Card */}
        <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-on-surface-variant uppercase tracking-wider">
              Connection Status
            </span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
              activeGuardian ? 'bg-emerald-500/15 text-emerald-600' : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              {activeGuardian ? 'Connected & Protected' : 'Not Paired'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-black">
                <Heart className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">
                  {activeGuardian ? `Sharing with: ${activeGuardian}` : 'No active caregiver connected'}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  {activeGuardian ? 'Real-time telemetry stream active' : 'Share the 6-digit code below to connect Phone B'}
                </span>
              </div>
            </div>

            {activeGuardian && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSharingPaused(!isSharingPaused)}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isSharingPaused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{isSharingPaused ? 'Resume Stream' : 'Pause Stream'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 6-DIGIT CODE & QR CODE SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: 6-Digit Code */}
          <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-md flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-extrabold text-secondary uppercase tracking-wider">
                Step 1: On Caregiver Phone
              </span>
              <h2 className="text-xl font-black text-on-surface">
                Your 6-Digit Pairing Code
              </h2>
              <p className="text-xs text-on-surface-variant">
                Enter this code on Phone B in the Caregiver Portal under &quot;My Dependents&quot; &gt; &quot;Add Dependent&quot;.
              </p>
            </div>

            {/* Code Box */}
            <div className="py-6 px-4 rounded-2xl bg-surface-container-low border-2 border-primary/30 flex flex-col items-center justify-center gap-2">
              {pairingCode ? (
                <>
                  <span className="text-4xl md:text-5xl font-black text-primary tracking-widest font-mono select-all">
                    {pairingCode}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-bold">
                    <Clock className="w-3.5 h-3.5 text-secondary" />
                    <span>Expires in {formatTime(timeLeftSec)}</span>
                  </div>
                </>
              ) : (
                <div className="py-3 flex flex-col items-center gap-2 animate-pulse">
                  <span className="text-base font-bold text-on-surface-variant font-mono">
                    Generating 6-digit code...
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRegenerateCode}
              disabled={isLoading}
              className="w-full h-11 rounded-2xl bg-surface-container-high hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-primary ${isLoading ? 'animate-spin' : ''}`} />
              <span>Regenerate New Code</span>
            </button>
          </div>

          {/* Card 2: QR Code */}
          <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-md flex flex-col items-center justify-between gap-4 text-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-extrabold text-primary uppercase tracking-wider">
                Fast Scan
              </span>
              <h2 className="text-xl font-black text-on-surface">
                Scan QR with Caregiver Phone
              </h2>
              <p className="text-xs text-on-surface-variant">
                Scan using camera on Caregiver phone to pair instantly.
              </p>
            </div>

            <div className="p-3 bg-white rounded-2xl shadow-sm border border-outline-variant/30 min-h-[160px] flex items-center justify-center">
              {pairingCode ? (
                <QRCodeDisplay text={`pathfinder:pair:${pairingCode}`} size={160} />
              ) : (
                <div className="w-40 h-40 bg-surface-container-low rounded-xl animate-pulse flex items-center justify-center text-xs text-on-surface-variant font-bold">
                  Loading QR...
                </div>
              )}
            </div>

            <span className="text-[11px] text-on-surface-variant font-bold">
              Encrypted end-to-end pairing token
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
