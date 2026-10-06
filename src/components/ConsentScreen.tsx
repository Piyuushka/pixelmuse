'use client';

import React from 'react';
import { Shield, Check, X, Lock } from 'lucide-react';

interface ConsentScreenProps {
  caregiverName: string;
  caregiverEmail: string;
  onApprove: () => void;
  onReject: () => void;
}

export function ConsentScreen({ caregiverName, caregiverEmail, onApprove, onReject }: ConsentScreenProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 shadow-2xl space-y-6 text-on-surface animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-on-surface">Data Sharing Consent Request</h2>
            <p className="text-xs text-on-surface-variant font-medium">Digital Personal Data Protection (DPDP) Act Compliance</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs space-y-3">
          <p className="font-semibold text-on-surface">
            <strong>{caregiverName || 'A Caregiver'}</strong> ({caregiverEmail}) is requesting permission to link with your account.
          </p>
          <div className="space-y-1.5 text-on-surface-variant">
            <p><strong>Permissions Granted upon approval:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Real-time GPS location tracking during navigation trips</li>
              <li>Emergency SOS alert notifications & continuous location broadcast</li>
              <li>Geofence entry/exit alerts & route-deviation warnings</li>
              <li>Battery level & device status monitoring</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onReject}
            className="flex-1 py-3 px-4 rounded-xl border border-outline-variant text-on-surface font-bold text-xs hover:bg-surface-container flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4 text-error" /> Reject Request
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/90 shadow-md flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Grant Consent & Approve
          </button>
        </div>
      </div>
    </div>
  );
}
