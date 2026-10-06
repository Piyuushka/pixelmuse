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
  Radio,
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

  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [sosStatus, setSosStatus] = useState<string>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleTriggerSOS = async (testMode = false) => {
    try {
      setSosStatus('TRIGGERED');
      speakText(
        testMode
          ? 'Safety drill alert triggered. Linked caregivers notified of test drill.'
          : 'Emergency SOS triggered! Broadcasting distress alert and live coordinates.'
      );

      const endpoint = '/api/sos/trigger';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTest: testMode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(
          testMode
            ? 'Safety drill alert broadcasted to linked caregiver devices.'
            : 'Emergency SOS broadcasted! Caregivers notified with live location coordinates.'
        );
      }
    } catch (err) {
      console.error('Failed to dispatch SOS:', err);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-md ${
              isTestMode ? 'bg-amber-500 text-white' : 'bg-error text-on-error'
            }`}>
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-on-surface tracking-tight">
                {isTestMode ? 'Safety Drill & SOS' : 'Emergency SOS & Hotlines'}
              </h1>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                {isTestMode
                  ? 'Perform a safe drill with linked caregivers to verify alert reception.'
                  : 'Immediate distress broadcast to linked caregivers and 1-tap emergency contacts.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTestMode(!isTestMode)}
            className={`px-4 py-2 rounded-2xl font-black text-xs uppercase cursor-pointer transition-colors self-start sm:self-auto ${
              isTestMode
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-surface-container-high hover:bg-surface-container text-on-surface'
            }`}
          >
            {isTestMode ? 'Safety Drill Mode (Active)' : 'Switch to Drill Mode'}
          </button>
        </div>

        {/* TEST MODE PERSISTENT BANNER */}
        {isTestMode && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  TEST ALERT · SAFETY DRILL ACTIVE
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  This is a simulated safety drill. Notifications are marked as a test drill on caregiver devices. No emergency 112 services are contacted.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTestMode(false)}
              className="px-3.5 py-1.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold cursor-pointer hover:bg-surface-container"
            >
              Exit Drill Mode
            </button>
          </div>
        )}

        {/* SOS Panic Trigger Button Card */}
        <div className={`bg-surface-container-lowest border-2 rounded-3xl p-8 flex flex-col items-center text-center gap-6 shadow-xl ${
          isTestMode ? 'border-amber-500/40' : 'border-error/30'
        }`}>
          <div className="flex flex-col items-center gap-1">
            <span className={`text-xs font-black uppercase tracking-widest ${
              isTestMode ? 'text-amber-500' : 'text-error'
            }`}>
              {isTestMode ? 'Simulated Emergency Drill' : 'High Priority Distress Broadcast'}
            </span>
            <h2 className="text-2xl font-black text-on-surface">
              {isTestMode ? 'Hold Button for Safety Drill' : 'Hold SOS Button for 3 Seconds'}
            </h2>
            <p className="text-xs text-on-surface-variant max-w-md">
              {isTestMode
                ? 'Holding down the button dispatches a simulated test alert to linked caregivers to verify audio siren delivery.'
                : 'Holding down the button broadcasts your live GPS coordinates, battery status, and triggers high-priority alerts on all linked caregiver devices.'}
            </p>
          </div>

          <div className="py-4">
            <SOSPanicButton
              isTestMode={isTestMode}
              onTrigger={(testMode) => handleTriggerSOS(testMode ?? isTestMode)}
            />
          </div>

          {sosStatus === 'TRIGGERED' && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-bold animate-pulse ${
              isTestMode
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-error/10 border-error/30 text-error'
            }`}>
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>
                {statusMessage || (isTestMode ? 'Safety drill alert delivered to linked caregivers.' : 'SOS broadcast active! Caregivers notified with live coordinates.')}
              </span>
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
