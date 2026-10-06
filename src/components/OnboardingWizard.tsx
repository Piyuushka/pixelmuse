'use client';

import React, { useState } from 'react';
import { Shield, User, Heart, Phone, Globe, Check, ArrowRight, ArrowLeft } from 'lucide-react';

export interface OnboardingData {
  fullName: string;
  ageGroup: string;
  mobilityNeeds: string[];
  emergencyContacts: { name: string; relation: string; phone: string }[];
  language: string;
  consentGranted: boolean;
}

interface OnboardingWizardProps {
  initialRole?: 'USER' | 'CAREGIVER';
  onComplete: (data: OnboardingData) => void;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
];

const MOBILITY_OPTIONS = [
  { id: 'wheelchair', label: 'Wheelchair User (Ramp & Elevator priority)' },
  { id: 'visual', label: 'Visual Impairment (High Contrast & Screen Reader)' },
  { id: 'hearing', label: 'Hearing Impairment (Visual Notifications & Alerts)' },
  { id: 'elderly', label: 'Elderly / Slow Paced (Minimal Stairs & Rest Stops)' },
  { id: 'cognitive', label: 'Cognitive / Memory Support (Simplified UI & Guided Routes)' },
  { id: 'none', label: 'No Specific Physical Barrier (Standard Navigation)' },
];

export function OnboardingWizard({ initialRole = 'USER', onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<OnboardingData>({
    fullName: '',
    ageGroup: 'adult',
    mobilityNeeds: [],
    emergencyContacts: [{ name: '', relation: '', phone: '' }],
    language: 'en',
    consentGranted: false,
  });

  const toggleMobility = (id: string) => {
    if (id === 'none') {
      setFormData((prev) => ({ ...prev, mobilityNeeds: ['none'] }));
      return;
    }
    setFormData((prev) => {
      const filtered = prev.mobilityNeeds.filter((m) => m !== 'none');
      if (filtered.includes(id)) {
        return { ...prev, mobilityNeeds: filtered.filter((m) => m !== id) };
      }
      return { ...prev, mobilityNeeds: [...filtered, id] };
    });
  };

  const updateContact = (index: number, field: string, value: string) => {
    const updated = [...formData.emergencyContacts];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, emergencyContacts: updated });
  };

  const addContact = () => {
    if (formData.emergencyContacts.length < 3) {
      setFormData({
        ...formData,
        emergencyContacts: [...formData.emergencyContacts, { name: '', relation: '', phone: '' }],
      });
    }
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
    else onComplete(formData);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-surface-container-lowest border border-outline-variant/40 rounded-3xl shadow-xl text-on-surface">
      {/* Progress Bar Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Step {step} of 5
          </span>
          <span className="text-xs font-semibold text-on-surface-variant">
            {step === 1 && 'Personal Details'}
            {step === 2 && 'Accessibility Preferences'}
            {step === 3 && 'Emergency Contacts'}
            {step === 4 && 'Language Preference'}
            {step === 5 && 'Data Consent & Safety'}
          </span>
        </div>
        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Personal Details */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Welcome to PathFinder</h2>
              <p className="text-sm text-on-surface-variant">Let's set up your profile for safe navigation.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="onboarding-fullname" className="block text-sm font-semibold mb-1 text-on-surface">Full Name</label>
              <input
                id="onboarding-fullname"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Ananya Sharma"
                className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="onboarding-agegroup" className="block text-sm font-semibold mb-1 text-on-surface">Age Group</label>
              <select
                id="onboarding-agegroup"
                value={formData.ageGroup}
                onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="child">Child / Student (Under 18)</option>
                <option value="adult">Adult (18 - 60)</option>
                <option value="senior">Senior Adult (60+)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Mobility Needs */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Accessibility & Mobility Profile</h2>
              <p className="text-sm text-on-surface-variant">Select all that apply to tailor route safety and navigation guidance.</p>
            </div>
          </div>

          <div className="space-y-3">
            {MOBILITY_OPTIONS.map((opt) => {
              const isSelected = formData.mobilityNeeds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleMobility(opt.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-on-surface font-semibold ring-1 ring-primary'
                      : 'border-outline-variant bg-surface text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="text-sm">{opt.label}</span>
                  {isSelected && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Emergency Contacts */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Emergency Contacts</h2>
              <p className="text-sm text-on-surface-variant">These contacts will be alerted immediately when SOS is triggered.</p>
            </div>
          </div>

          <div className="space-y-4">
            {formData.emergencyContacts.map((contact, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-outline-variant bg-surface space-y-3">
                <span className="text-xs font-bold uppercase text-primary">Contact #{idx + 1}</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Name"
                    value={contact.name}
                    onChange={(e) => updateContact(idx, 'name', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Relation (e.g. Mother)"
                    value={contact.relation}
                    onChange={(e) => updateContact(idx, 'relation', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="10-digit Phone"
                    value={contact.phone}
                    onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-sm"
                  />
                </div>
              </div>
            ))}

            {formData.emergencyContacts.length < 3 && (
              <button
                type="button"
                onClick={addContact}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                + Add Another Emergency Contact
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Language */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Preferred Language</h2>
              <p className="text-sm text-on-surface-variant">Select your primary language for voice prompts & interface.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LANGUAGES.map((lang) => {
              const isSelected = formData.language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setFormData({ ...formData, language: lang.code })}
                  className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-on-surface font-semibold ring-1 ring-primary'
                      : 'border-outline-variant bg-surface text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="text-sm font-medium">{lang.label}</span>
                  {isSelected && <Check className="w-5 h-5 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 5: Consent */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Data Privacy & Safety Consent</h2>
              <p className="text-sm text-on-surface-variant">Digital Personal Data Protection (DPDP) Act Compliance.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-outline-variant bg-surface text-xs space-y-3 leading-relaxed text-on-surface-variant">
            <p>
              <strong>What data we collect:</strong> Live GPS location during active trips, battery percentage, geofence status, and emergency alert history.
            </p>
            <p>
              <strong>Who can see it:</strong> Only your explicitly paired Caregiver(s). Data is encrypted in transit and never sold to third parties.
            </p>
            <p>
              <strong>Your rights:</strong> You can revoke caregiver access or delete your location history at any time from your profile settings.
            </p>
          </div>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-outline-variant bg-surface cursor-pointer hover:bg-surface-container">
            <input
              type="checkbox"
              checked={formData.consentGranted}
              onChange={(e) => setFormData({ ...formData, consentGranted: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span className="text-xs text-on-surface font-medium">
              I agree to share real-time location data with my paired Caregiver for safety tracking and emergency response under DPDP guidelines.
            </span>
          </label>
        </div>
      )}

      {/* Footer Navigation Buttons */}
      <div className="mt-8 pt-4 border-t border-outline-variant/40 flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface font-semibold text-sm hover:bg-surface-container flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={step === 5 && !formData.consentGranted}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
            step === 5 && !formData.consentGranted
              ? 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed'
              : 'bg-primary text-on-primary hover:bg-primary/90 shadow-md'
          }`}
        >
          {step === 5 ? 'Complete Setup' : 'Continue'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
