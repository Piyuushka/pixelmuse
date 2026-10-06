'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccessibility, PersonaType } from '@/context/AccessibilityContext';
import {
  Navigation,
  User,
  Phone,
  Globe,
  Accessibility,
  Footprints,
  Eye,
  Heart,
  AlertOctagon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';

interface EmergencyContactItem {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  notifyOnSOS: boolean;
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

const PERSONAS: { id: PersonaType; label: string; desc: string; icon: React.ElementType }[] = [
  {
    id: 'wheelchair',
    label: 'Wheelchair User',
    desc: 'Step-free paths, maximum 5% slopes, elevator access and curb cuts',
    icon: Accessibility,
  },
  {
    id: 'older-adult',
    label: 'Older Adult / Reduced Stamina',
    desc: 'Fewer stairs, low gradient pathways, resting spots, and safe crosswalks',
    icon: Footprints,
  },
  {
    id: 'low-vision',
    label: 'Low Vision / Tactile Navigation',
    desc: 'Audio beacons, tactile paving paths, predictable walkway geometry',
    icon: Eye,
  },
  {
    id: 'caregiver',
    label: 'Companion / Caregiver Assist',
    desc: 'Wide sidewalk routing, smooth paving, ramp access for stroller or wheelchair',
    icon: Heart,
  },
];

function UserProfileSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  const { speakText, setPersona } = useAccessibility();

  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [mobilityPersona, setMobilityPersona] = useState<PersonaType>('wheelchair');
  const [mobilityType, setMobilityType] = useState('electric-wheelchair');
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactItem[]>([
    {
      id: 'ec_init_1',
      name: '',
      phone: '',
      relationship: 'Parent / Primary Guardian',
      notifyOnSOS: true,
    },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadCurrentProfile() {
      try {
        const res = await fetch('/api/user/profile-setup');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setName(data.user.name || '');
            setEmail(data.user.email || '');
            if (data.user.preferredLanguage) setPreferredLanguage(data.user.preferredLanguage);
            if (data.user.primaryPersona) setMobilityPersona(data.user.primaryPersona);
            if (data.user.mobilityType) setMobilityType(data.user.mobilityType);
            if (data.user.emergencyContacts && data.user.emergencyContacts.length > 0) {
              setEmergencyContacts(data.user.emergencyContacts);
            }
          }
        }
      } catch (err) {
        console.warn('Could not prefill user profile:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCurrentProfile();
  }, []);

  const validateStep1 = () => {
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep2 = () => {
    if (!mobilityPersona) {
      setErrorMessage('Please select a mobility profile.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep3 = () => {
    if (emergencyContacts.length === 0 || !emergencyContacts[0].name.trim() || !emergencyContacts[0].phone.trim()) {
      setErrorMessage('Please provide at least one emergency contact with a name and phone number.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      speakText('Step 2: Mobility persona selection');
    } else if (step === 2 && validateStep2()) {
      setStep(3);
      speakText('Step 3: Emergency contacts');
    }
  };

  const handlePrevStep = () => {
    setErrorMessage('');
    if (step > 1) setStep(step - 1);
  };

  const handleAddContact = () => {
    setEmergencyContacts([
      ...emergencyContacts,
      {
        id: `ec_${Date.now()}`,
        name: '',
        phone: '',
        relationship: 'Family Member',
        notifyOnSOS: true,
      },
    ]);
  };

  const handleRemoveContact = (index: number) => {
    if (emergencyContacts.length <= 1) return;
    setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, field: keyof EmergencyContactItem, value: any) => {
    const updated = [...emergencyContacts];
    updated[index] = { ...updated[index], [field]: value };
    setEmergencyContacts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) return;
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/user/profile-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          mobilityPersona,
          mobilityType,
          emergencyContacts,
          preferredLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save user profile.');
      }

      setPersona(mobilityPersona);
      setSuccessMessage('Profile setup complete! Redirecting to Navigator Home...');
      speakText(`Profile completed for ${name.trim()}. Opening map.`);

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
            role: 'USER',
          })
        );
      }

      setTimeout(() => {
        router.replace('/user/map');
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving user profile.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="text-xs font-bold text-on-surface-variant">Loading user profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-4 md:p-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 mb-6 text-center">
        <div className="w-13 h-13 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-lg mb-1">
          <Navigation className="w-7 h-7 text-white fill-current" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-on-surface">
          {isEditMode ? 'Edit Navigator Profile' : 'Navigator Profile Setup'}
        </h1>
        <p className="text-xs md:text-sm text-on-surface-variant font-bold max-w-md">
          {isEditMode
            ? 'Adjust your mobility persona and emergency SOS contacts.'
            : 'Personalize your accessibility routing and set emergency contacts for one-tap SOS.'}
        </p>
      </div>

      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-xl p-6 md:p-10 flex flex-col gap-6">
        
        {/* PROGRESS INDICATOR */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-on-surface">
            <span className={step >= 1 ? 'text-secondary' : 'text-on-surface-variant'}>
              1. Identity & Language
            </span>
            <span className={step >= 2 ? 'text-secondary' : 'text-on-surface-variant'}>
              2. Mobility Needs
            </span>
            <span className={step >= 3 ? 'text-secondary' : 'text-on-surface-variant'}>
              3. SOS Contacts
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full bg-secondary transition-all duration-300 rounded-full"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* ALERTS */}
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
          
          {/* STEP 1: IDENTITY & LANGUAGE */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-on-surface">Your Details</h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Enter your name as you would like it displayed in your navigation interface.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="user-name" className="text-xs font-extrabold text-on-surface">
                  Full Name <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <input
                    id="user-name"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="user-language" className="text-xs font-extrabold text-on-surface">
                  Preferred Language <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3.5" />
                  <select
                    id="user-language"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
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

          {/* STEP 2: MOBILITY PROFILE */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-on-surface">Select Mobility Profile</h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  PathFinder adapts sidewalks, crosswalks, ramps, and obstacle avoidance according to your selection.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERSONAS.map((p) => {
                  const Icon = p.icon;
                  const isSelected = mobilityPersona === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setMobilityPersona(p.id)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-secondary/10 border-secondary shadow-sm'
                          : 'bg-surface-container-low border-outline-variant/30 hover:border-secondary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-secondary' : 'text-on-surface-variant'}`} />
                          <span className="text-xs font-black text-on-surface">{p.label}</span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-secondary bg-secondary' : 'border-outline-variant/60'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                        {p.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {mobilityPersona === 'wheelchair' && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mobility-type" className="text-xs font-extrabold text-on-surface">
                    Wheelchair Equipment Type
                  </label>
                  <select
                    id="mobility-type"
                    value={mobilityType}
                    onChange={(e) => setMobilityType(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface"
                  >
                    <option value="electric-wheelchair">Motorized / Electric Wheelchair</option>
                    <option value="manual-wheelchair">Manual Push Wheelchair</option>
                    <option value="mobility-scooter">Three / Four Wheel Mobility Scooter</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: EMERGENCY SOS CONTACTS */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-on-surface">Emergency SOS Contacts</h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  When you press the one-tap emergency SOS button, live telemetry coordinates will be broadcast to these contacts.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {emergencyContacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-on-surface">Contact #{index + 1}</span>
                      {emergencyContacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(index)}
                          aria-label="Remove contact"
                          className="p-1 rounded-lg text-error hover:bg-error/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-on-surface">Contact Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Contact full name"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-on-surface"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-on-surface">Phone Number</label>
                        <input
                          type="tel"
                          required
                          placeholder="+91 98765 43210"
                          value={contact.phone}
                          onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold text-on-surface"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Relationship (e.g. Parent)"
                          value={contact.relationship}
                          onChange={(e) => handleContactChange(index, 'relationship', e.target.value)}
                          className="h-8 px-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-[11px] font-medium text-on-surface"
                        />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                        <input
                          type="checkbox"
                          checked={contact.notifyOnSOS}
                          onChange={(e) => handleContactChange(index, 'notifyOnSOS', e.target.checked)}
                          className="w-4 h-4 rounded accent-secondary cursor-pointer"
                        />
                        <span>Notify on SOS</span>
                      </label>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddContact}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-outline-variant/60 hover:border-secondary text-on-surface-variant hover:text-secondary text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Emergency Contact</span>
                </button>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
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
                key="user-next-btn"
                type="button"
                id="user-next-btn"
                data-testid="user-next-btn"
                onClick={handleNextStep}
                className="h-12 px-6 rounded-2xl bg-secondary text-on-secondary font-black text-xs flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer ml-auto"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                key="user-submit-btn"
                type="button"
                id="submit-user-profile"
                data-testid="submit-user-profile"
                disabled={isSubmitting}
                onClick={(e) => handleSubmit(e as any)}
                className="h-12 px-6 rounded-2xl bg-secondary text-on-secondary font-black text-xs flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50 ml-auto"
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

export default function UserProfileSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen flex items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-secondary border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-on-surface-variant">Loading navigator setup...</span>
          </div>
        </div>
      }
    >
      <UserProfileSetupContent />
    </Suspense>
  );
}
