'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import { SOSPanicButton } from '@/components/SOSPanicButton';
import {
  AlertOctagon,
  PhoneCall,
  ShieldAlert,
  ArrowLeft,
  HeartPulse,
  Navigation,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const INDIA_EMERGENCY_NUMBERS = [
  { number: '112', label: 'National Emergency', desc: 'All-in-one Emergency Helpline' },
  { number: '100', label: 'Police Control Room', desc: 'State Police Command Center' },
  { number: '108', label: 'Ambulance (NHM)', desc: 'Medical Emergency & Paramedics' },
  { number: '101', label: 'Fire Service', desc: 'Fire & Rescue Brigade' },
  { number: '1091', label: 'Women Helpline', desc: 'Women Safety & Protection' },
  { number: '1098', label: 'Childline', desc: 'Child Protection Helpline' },
  { number: '14567', label: 'Elderline', desc: 'Senior Citizen Care & Assistance' },
];

export default function UserSOSPage() {
  const { user, speakText } = useAccessibility();

  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [sosStatus, setSosStatus] = useState<string>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleTriggerSOS = async (testMode = true) => {
    try {
      setSosStatus('TRIGGERED');
      speakText(
        testMode
          ? 'Test emergency panic alert triggered.'
          : 'Emergency SOS triggered! Alerting caregivers and emergency network.'
      );

      const endpoint = '/api/sos/trigger';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTest: testMode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(data.message || 'SOS alert broadcasted to linked caregivers.');
      }
    } catch (err) {
      console.error('Failed to dispatch SOS:', err);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-error text-on-error flex items-center justify-center font-black shadow-md">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-on-surface tracking-tight">
              Emergency SOS & Hotlines
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant font-medium">
              Immediate distress broadcast to linked caregivers and 1-tap emergency contacts.
            </p>
          </div>
        </div>

        {/* TEST MODE WARNING BANNER */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Demo & Safety Test Mode Active
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Alerts are broadcasted to linked Caregiver Phone B only. No external 112 emergency dispatchers are contacted during this demo.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTestMode(!isTestMode)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase cursor-pointer transition-colors ${
              isTestMode ? 'bg-amber-500 text-white' : 'bg-surface-container-high text-on-surface'
            }`}
          >
            {isTestMode ? 'Test Mode (Safe)' : 'Live Mode'}
          </button>
        </div>

        {/* SOS Panic Trigger Button Card */}
        <div className="bg-surface-container-lowest border-2 border-error/30 rounded-3xl p-8 flex flex-col items-center text-center gap-6 shadow-xl">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-black text-error uppercase tracking-widest">
              High Priority Distress Action
            </span>
            <h2 className="text-2xl font-black text-on-surface">
              Hold SOS Button for 3 Seconds
            </h2>
            <p className="text-xs text-on-surface-variant max-w-md">
              Holding down the button broadcasts your live GPS coordinates, battery status, and triggers a siren on all linked caregiver devices.
            </p>
          </div>

          <div className="py-4">
            <SOSPanicButton
              isTestMode={isTestMode}
              onTrigger={(testMode) => handleTriggerSOS(testMode ?? isTestMode)}
            />
          </div>

          {sosStatus === 'TRIGGERED' && (
            <div className="p-4 rounded-2xl bg-error/10 border border-error/30 text-error flex items-center gap-3 text-xs font-bold animate-pulse">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{statusMessage || 'SOS broadcast active! Caregiver phone notified with high priority siren.'}</span>
            </div>
          )}
        </div>

        {/* National Emergency Numbers Grid */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-primary" />
              <h3 className="text-base font-black text-on-surface">
                National Emergency Hotlines (India)
              </h3>
            </div>
            <span className="text-[10px] text-on-surface-variant font-bold uppercase">
              Toll-Free 24/7
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {INDIA_EMERGENCY_NUMBERS.map(item => (
              <a
                key={item.number}
                href={`tel:${item.number}`}
                className="p-4 rounded-2xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="text-lg font-black text-primary group-hover:text-secondary transition-colors">
                    {item.number}
                  </span>
                  <span className="text-xs font-bold text-on-surface">{item.label}</span>
                  <span className="text-[10px] text-on-surface-variant">{item.desc}</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-all">
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
