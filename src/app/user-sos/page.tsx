'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import { SOSPanicButton } from '@/components/SOSPanicButton';
import {
  Siren,
  PhoneCall,
  ShieldAlert,
  ArrowLeft,
  Building2,
  HeartPulse,
  Navigation,
  CheckCircle2,
} from 'lucide-react';

const INDIA_EMERGENCY_NUMBERS = [
  { number: '112', label: 'National Emergency', desc: 'All-in-one Emergency Helpline' },
  { number: '100', label: 'Police', desc: 'State Police Command Center' },
  { number: '108', label: 'Ambulance (NHM)', desc: 'Medical Emergency Services' },
  { number: '101', label: 'Fire Service', desc: 'Fire & Rescue Brigade' },
  { number: '1091', label: 'Women Helpline', desc: 'Women Safety & Protection' },
  { number: '1098', label: 'Childline', desc: 'Child Protection Helpline' },
  { number: '14567', label: 'Elderline', desc: 'Senior Citizen Care & Assistance' },
];

export default function UserSOSPage() {
  const { user, speakText } = useAccessibility();

  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [sosStatus, setSosStatus] = useState<string>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleTriggerSOS = async (testMode = false) => {
    try {
      setSosStatus('TRIGGERED');
      speakText(testMode ? 'Test emergency panic alert triggered.' : 'Emergency SOS triggered! Alerting caregivers and emergency network.');

      const endpoint = testMode ? '/api/sos/test' : '/api/sos/trigger';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTest: testMode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(data.message);
      }
    } catch (err) {
      console.error('Failed to dispatch SOS:', err);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <Link href="/safety-routing" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to Navigation
          </Link>

          {/* Test Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsTestMode(!isTestMode)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              isTestMode
                ? 'bg-amber-500 text-black border-amber-600 shadow-md'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-high'
            }`}
          >
            {isTestMode ? '[TEST MODE ENABLED]' : 'Switch to Test Mode'}
          </button>
        </div>

        {/* SOS Panic Trigger Card */}
        <div className="p-8 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl flex flex-col items-center justify-center space-y-6">
          <SOSPanicButton onTrigger={handleTriggerSOS} isTestMode={isTestMode} />

          {sosStatus === 'TRIGGERED' && (
            <div className="p-4 rounded-2xl bg-red-500/10 text-red-600 border border-red-500/20 text-xs font-bold flex items-center gap-2 max-w-md animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage || 'SOS Alert successfully dispatched! Caregivers have been notified.'}</span>
            </div>
          )}
        </div>

        {/* India Emergency Directory */}
        <div className="p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black text-on-surface">India Emergency Numbers</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INDIA_EMERGENCY_NUMBERS.map((item) => (
              <a
                key={item.number}
                href={`tel:${item.number}`}
                className="p-4 rounded-2xl bg-surface-container-low hover:bg-primary/10 border border-outline-variant/30 transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-xl font-black text-primary group-hover:underline">{item.number}</span>
                  <h3 className="text-xs font-bold text-on-surface">{item.label}</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium">{item.desc}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-sm">
                  <PhoneCall className="w-4 h-4" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
