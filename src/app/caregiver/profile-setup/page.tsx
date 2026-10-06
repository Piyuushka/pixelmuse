'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  ShieldCheck,
  User,
  Phone,
  Heart,
  Globe,
  Bell,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Camera,
  Trash2,
  Mail,
  Smartphone,
  Send,
  Sparkles,
} from 'lucide-react';

interface AlertPrefs {
  push: boolean;
  sms: boolean;
  email: boolean;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
];

const RELATIONSHIPS = [
  { id: 'parent', label: 'Parent / Mother / Father', desc: 'Primary guardian of child or dependent' },
  { id: 'guardian', label: 'Legal Guardian', desc: 'Court or family designated legal guardian' },
  { id: 'family', label: 'Family Member', desc: 'Sibling, adult child, or relative' },
  { id: 'professional_caregiver', label: 'Professional Caregiver', desc: 'Nurse, personal care assistant, or support worker' },
];

function CaregiverProfileSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  const { speakText, user, loginUser } = useAccessibility();

  // Form State
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [alertPreferences, setAlertPreferences] = useState<AlertPrefs>({
    push: true,
    sms: true,
    email: true,
  });
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current profile on mount
  useEffect(() => {
    async function loadCurrentProfile() {
      try {
        const res = await fetch('/api/caregiver/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setName(data.user.name || '');
            setEmail(data.user.email || '');
            setPhone(data.user.phone || '');
            if (data.user.relationship) setRelationship(data.user.relationship);
            if (data.user.preferredLanguage) setPreferredLanguage(data.user.preferredLanguage);
            if (data.user.alertPreferences) setAlertPreferences(data.user.alertPreferences);
            if (data.user.photoUrl) setPhotoUrl(data.user.photoUrl);
          }
        }
      } catch (err) {
        console.warn('Could not prefill caregiver profile:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCurrentProfile();
  }, []);

  // Validation functions
  const validateStep1 = () => {
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return false;
    }
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('Please enter a valid phone number (at least 8 digits).');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep2 = () => {
    if (!relationship) {
      setErrorMessage('Please select your relationship to the dependent.');
      return false;
    }
    if (!preferredLanguage) {
      setErrorMessage('Please select your preferred language.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep3 = () => {
    if (!alertPreferences.push && !alertPreferences.sms && !alertPreferences.email) {
      setErrorMessage('Please enable at least one alert notification method.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      speakText('Step 2: Relationship and preferred language');
    } else if (step === 2 && validateStep2()) {
      setStep(3);
      speakText('Step 3: Alert preferences and confirmation');
    }
  };

  const handlePrevStep = () => {
    setErrorMessage('');
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Photo size should be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
      setErrorMessage('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) return;
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/caregiver/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          relationship,
          preferredLanguage,
          alertPreferences,
          photoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save caregiver profile.');
      }

      setSuccessMessage('Profile saved successfully! Redirecting to Live Tracking Map...');
      speakText(`Profile completed for ${name.trim()}. Launching live tracking map.`);

      // Update localStorage cached profile so sidebar shows immediately
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('pathfinder_user');
        const userObj = cached ? JSON.parse(cached) : {};
        localStorage.setItem(
          'pathfinder_user',
          JSON.stringify({
            ...userObj,
            name: name.trim(),
            email: data.user?.email || email,
            isLoggedIn: true,
            hasCompletedProfile: true,
            role: 'CAREGIVER',
          })
        );
      }

      // Redirect to Live Tracking Map
      setTimeout(() => {
        router.replace('/caregiver/map');
      }, 200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving profile.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="text-xs font-bold text-on-surface-variant">Loading caregiver profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-4 md:p-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 mb-6 text-center">
        <div className="w-13 h-13 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-lg mb-1">
          <ShieldCheck className="w-7 h-7 text-white fill-current" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">
          {isEditMode ? 'Edit Caregiver Profile' : 'Caregiver Profile Setup'}
        </h1>
        <p className="text-xs md:text-sm text-on-surface-variant font-bold max-w-md">
          {isEditMode
            ? 'Update your contact information, relationship, and emergency alerts.'
            : 'Complete your profile to enable live two-phone tracking and emergency alerts.'}
        </p>
      </div>

      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-xl p-6 md:p-10 flex flex-col gap-6">
        
        {/* PROGRESS INDICATOR */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-on-surface">
            <span className={step >= 1 ? 'text-primary' : 'text-on-surface-variant'}>
              1. Personal Details
            </span>
            <span className={step >= 2 ? 'text-primary' : 'text-on-surface-variant'}>
              2. Role & Language
            </span>
            <span className={step >= 3 ? 'text-primary' : 'text-on-surface-variant'}>
              3. Alert Preferences
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* ERROR / SUCCESS ALERTS */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-error/10 text-error text-xs font-bold border border-error/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* ─────────────────────────────────────────────────────────────
              STEP 1: PERSONAL DETAILS (Full Name, Phone, Optional Photo)
          ───────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-on-surface">Personal Information</h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Your dependent will see this name and contact during navigation and SOS alerts.
                </p>
              </div>

              {/* Photo Upload (Optional) */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                <div className="relative w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center overflow-hidden border border-outline-variant/40 flex-shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Caregiver profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-on-surface-variant" />
                  )}
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <span className="text-xs font-extrabold text-on-surface">Profile Photo (Optional)</span>
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    Upload an avatar image (PNG or JPG, max 2MB)
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-surface-container-highest hover:bg-surface-container text-on-surface text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        aria-label="Remove photo"
                        className="p-1.5 rounded-xl bg-error/10 text-error hover:bg-error/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="caregiver-name" className="text-xs font-extrabold text-on-surface">
                  Full Name <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <input
                    id="caregiver-name"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="caregiver-phone" className="text-xs font-extrabold text-on-surface">
                  Phone Number (for critical SOS SMS alerts) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <input
                    id="caregiver-phone"
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Email (Readonly) */}
              {email && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-on-surface-variant">Account Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      readOnly
                      disabled
                      value={email}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-high/50 border border-outline-variant/20 text-xs font-medium text-on-surface-variant cursor-not-allowed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 2: ROLE & PREFERRED LANGUAGE
          ───────────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-on-surface">Relationship & Language</h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Select your caregiver role and the primary language for voice and alert prompts.
                </p>
              </div>

              {/* Relationship Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-extrabold text-on-surface">
                  Relationship to Dependent <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {RELATIONSHIPS.map((r) => {
                    const isSelected = relationship === r.id;
                    return (
                      <div
                        key={r.id}
                        id={`rel-choice-${r.id}`}
                        data-testid={`rel-choice-${r.id}`}
                        onClick={() => setRelationship(r.id)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-primary/10 border-primary shadow-sm'
                            : 'bg-surface-container-low border-outline-variant/30 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-on-surface">{r.label}</span>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary bg-primary' : 'border-outline-variant/60'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <span className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                          {r.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Language */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="caregiver-language" className="text-xs font-extrabold text-on-surface">
                  Preferred Language <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <select
                    id="caregiver-language"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              STEP 3: ALERT PREFERENCES & CONFIRMATION
          ───────────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-on-surface">Emergency Alert Channels</h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Choose how PathFinder notifies you when your dependent presses SOS or leaves safe zones.
                </p>
              </div>

              {/* Notification Toggles */}
              <div className="flex flex-col gap-3">
                {/* Push Notifications */}
                <div
                  onClick={() =>
                    setAlertPreferences((prev) => ({ ...prev, push: !prev.push }))
                  }
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    alertPreferences.push
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface-container-low border-outline-variant/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-on-surface">Push Notifications</span>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Instant sound and high-priority banner on device screen
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={alertPreferences.push}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary cursor-pointer"
                  />
                </div>

                {/* SMS Text Messages */}
                <div
                  onClick={() =>
                    setAlertPreferences((prev) => ({ ...prev, sms: !prev.sms }))
                  }
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    alertPreferences.sms
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface-container-low border-outline-variant/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center font-bold">
                      <Send className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-on-surface">SMS Distress Alerts</span>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Immediate coordinates texted to {phone || 'your phone number'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={alertPreferences.sms}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary cursor-pointer"
                  />
                </div>

                {/* Email Alerts */}
                <div
                  onClick={() =>
                    setAlertPreferences((prev) => ({ ...prev, email: !prev.email }))
                  }
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    alertPreferences.email
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface-container-low border-outline-variant/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center font-bold">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-on-surface">Email Incident Summary</span>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Detailed incident report with route geometry
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={alertPreferences.email}
                    onChange={() => {}}
                    className="w-5 h-5 rounded accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* Review summary card */}
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <span className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider">
                  Summary
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-on-surface-variant font-medium">Name: </span>
                    <span className="font-extrabold text-on-surface">{name}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant font-medium">Phone: </span>
                    <span className="font-extrabold text-on-surface">{phone}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant font-medium">Role: </span>
                    <span className="font-extrabold text-on-surface capitalize">
                      {relationship.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant font-medium">Language: </span>
                    <span className="font-extrabold text-on-surface">
                      {LANGUAGES.find((l) => l.code === preferredLanguage)?.label || 'English'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS (Back, Next, Submit) */}
          <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="h-12 px-5 rounded-2xl bg-surface-container-high hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                key="caregiver-next-btn"
                type="button"
                id="caregiver-next-btn"
                data-testid="caregiver-next-btn"
                onClick={handleNextStep}
                className="h-12 px-6 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer ml-auto"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                key="caregiver-submit-btn"
                type="button"
                id="submit-caregiver-profile"
                data-testid="submit-caregiver-profile"
                disabled={isSubmitting}
                onClick={(e) => handleSubmit(e as any)}
                className="h-12 px-6 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 ml-auto"
              >
                <span>{isSubmitting ? 'Saving Profile...' : isEditMode ? 'Save Changes' : 'Complete Setup & Open Map'}</span>
                <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CaregiverProfileSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen flex items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-on-surface-variant">Loading caregiver setup...</span>
          </div>
        </div>
      }
    >
      <CaregiverProfileSetupContent />
    </Suspense>
  );
}
