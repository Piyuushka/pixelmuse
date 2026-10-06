'use client';

import React, { useState } from 'react';
import { useAccessibility, PersonaType, AccessibilityPreferences } from '@/context/AccessibilityContext';
import Logo from './Logo';
import {
  Navigation,
  ShieldCheck,
  MapPin,
  Accessibility,
  Eye,
  Footprints,
  Heart,
  User,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Sliders,
  Volume2,
  Contrast,
  Lock,
  Mail,
  X,
  ChevronRight,
  Compass,
  Check,
  SlidersHorizontal,
} from 'lucide-react';

interface OnboardingFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: 'landing' | 'auth' | 'profile';
}

export default function OnboardingFlowModal({
  isOpen,
  onClose,
  initialStep = 'landing',
}: OnboardingFlowModalProps) {
  const {
    user,
    accessibilityPreferences,
    loginUser,
    registerUser,
    saveAccessibilityProfile,
    speakText,
  } = useAccessibility();

  // Internal step management: 1 = landing, 2 = auth (login/register), 3 = profile questionnaire, 4 = complete
  const [step, setStep] = useState<number>(() => {
    if (initialStep === 'profile') return 3;
    if (initialStep === 'auth') return 2;
    if (user.isLoggedIn && !user.hasCompletedProfile) return 3;
    return 1;
  });

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Questionnaire form state
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>(
    accessibilityPreferences.primaryPersona || 'wheelchair'
  );
  const [mobilityType, setMobilityType] = useState<string>(
    accessibilityPreferences.mobilityType || 'electric-wheelchair'
  );
  const [requireStepFree, setRequireStepFree] = useState<boolean>(
    accessibilityPreferences.requireStepFree ?? true
  );
  const [maxSlopePercent, setMaxSlopePercent] = useState<number>(
    accessibilityPreferences.maxSlopePercent || 5
  );
  const [preferLowerSlopes, setPreferLowerSlopes] = useState<boolean>(
    accessibilityPreferences.preferLowerSlopes ?? true
  );
  const [preferReducedDistance, setPreferReducedDistance] = useState<boolean>(
    accessibilityPreferences.preferReducedDistance ?? true
  );
  const [preferSaferCrossings, setPreferSaferCrossings] = useState<boolean>(
    accessibilityPreferences.preferSaferCrossings ?? true
  );
  const [avoidStairs, setAvoidStairs] = useState<boolean>(
    accessibilityPreferences.avoidStairs ?? true
  );
  const [needTactilePaving, setNeedTactilePaving] = useState<boolean>(
    accessibilityPreferences.needTactilePaving ?? false
  );
  const [needAudioPrompts, setNeedAudioPrompts] = useState<boolean>(
    accessibilityPreferences.needAudioPrompts ?? true
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Handle Auth submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }
    if (authMode === 'register' && !name) {
      setAuthError('Please enter your full name.');
      return;
    }
    setAuthError('');
    setIsSubmitting(true);

    try {
      if (authMode === 'login') {
        const loggedUser = await loginUser(email, password);
        speakText(`Welcome back ${loggedUser.name || 'Navigator'}. Loading your saved accessibility profile.`);
        
        // If profile was already completed in DB, skip questionnaire and land on Dashboard directly!
        if (loggedUser.hasCompletedProfile) {
          onClose();
          return;
        }
        
        // Otherwise, open questionnaire for first-time setup
        setStep(3);
      } else {
        const registeredUser = await registerUser(name, email, password);
        speakText(`Account registered for ${registeredUser.name}. Let's set up your accessibility profile.`);
        setStep(3);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError('');

    try {
      const updatedProfile: Partial<AccessibilityPreferences> = {
        primaryPersona: selectedPersona,
        mobilityType,
        requireStepFree,
        maxSlopePercent,
        preferLowerSlopes,
        preferReducedDistance,
        preferSaferCrossings,
        avoidStairs,
        needTactilePaving,
        needAudioPrompts,
      };

      await saveAccessibilityProfile(updatedProfile);
      speakText('Accessibility preferences saved successfully to database. Loading your personalized dashboard.');

      setStep(4);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to save profile to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-2xl overflow-hidden my-8">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div>
              <span className="text-base font-black text-on-surface tracking-tight">
                PathFinder Access
              </span>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">
                Barrier-Free Navigation Core
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Step progress pills */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
              <span className={`px-2 py-0.5 rounded-full ${step >= 1 ? 'bg-primary text-on-primary font-black' : 'bg-surface-container'}`}>1</span>
              <span>→</span>
              <span className={`px-2 py-0.5 rounded-full ${step >= 2 ? 'bg-primary text-on-primary font-black' : 'bg-surface-container'}`}>2</span>
              <span>→</span>
              <span className={`px-2 py-0.5 rounded-full ${step >= 3 ? 'bg-primary text-on-primary font-black' : 'bg-surface-container'}`}>3</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 1: LANDING SCREEN
        ───────────────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-6 md:p-8 flex flex-col gap-6 text-left">
            {/* Main Brand Hero */}
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-extrabold w-fit">
                <Sparkles className="w-3.5 h-3.5" />
                <span>WCAG AAA Accessible Community Navigation</span>
              </div>
              <h1 id="onboarding-title" className="text-3xl sm:text-4xl font-black text-on-surface tracking-tight leading-tight">
                Welcome to <span className="text-primary">PathFinder Access</span>
              </h1>
              <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                Precision GPS guidance, real-time community barrier alerts, and personalized step-free route planning tailored to your exact mobility needs.
              </p>
            </div>

            {/* Key Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Accessibility className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black text-on-surface">Step-Free Guarantees</h2>
                <p className="text-[11px] text-on-surface-variant">Ramp, elevator & curb-cut routing verified in real time.</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <div className="w-8 h-8 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black text-on-surface">Custom Slope Tolerances</h2>
                <p className="text-[11px] text-on-surface-variant">Filter out steep inclines based on your preferred maximum slope.</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                <div className="w-8 h-8 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center">
                  <Volume2 className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black text-on-surface">Voice & High Contrast</h2>
                <p className="text-[11px] text-on-surface-variant">Spoken turn-by-turn guidance and WCAG high-contrast themes.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setStep(2);
                }}
                className="w-full sm:flex-1 h-13 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer"
              >
                <span>Register New Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setStep(2);
                }}
                className="w-full sm:flex-1 h-13 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-sm text-on-surface flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-primary" />
                <span>Log In</span>
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  loginUser('Guest Navigator', 'guest@pathfinder.internal');
                  setStep(3);
                }}
                className="text-xs text-on-surface-variant font-semibold hover:text-primary underline underline-offset-4 cursor-pointer"
              >
                Skip authentication and set up Accessibility Profile as Guest →
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 2: LOGIN / REGISTER AUTH FORM
        ───────────────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="p-6 md:p-8 flex flex-col gap-6">
            {/* Header & Tabs */}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-black text-on-surface tracking-tight">
                {authMode === 'login' ? 'Log In to PathFinder' : 'Create Your Profile'}
              </h1>
              <p className="text-xs text-on-surface-variant font-medium">
                Save your accessibility needs securely across device navigation sessions.
              </p>

              {/* Tab Selector */}
              <div className="flex rounded-2xl bg-surface-container-low p-1 border border-outline-variant/30 mt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Log In
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
              {authError && (
                <div className="p-3 rounded-xl bg-error/10 text-error text-xs font-bold border border-error/20">
                  {authError}
                </div>
              )}

              {authMode === 'register' && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="auth-name" className="text-xs font-extrabold text-on-surface">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
                    <input
                      id="auth-name"
                      type="text"
                      placeholder="Your full name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-email" className="text-xs font-extrabold text-on-surface">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-password" className="text-xs font-extrabold text-on-surface">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-3" />
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  ← Back
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 px-6 rounded-2xl bg-primary text-on-primary font-black text-xs flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {isSubmitting
                      ? 'Authenticating...'
                      : authMode === 'login'
                      ? 'Log In & Continue'
                      : 'Create Account & Continue'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 3: ACCESSIBILITY NEEDS QUESTIONNAIRE
        ───────────────────────────────────────────────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleSaveProfile} className="p-6 md:p-8 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col gap-1 border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-primary uppercase tracking-wider">
                <Sliders className="w-4 h-4" />
                <span>Step 3 of 3 · Personalization</span>
              </div>
              <h1 className="text-2xl font-black text-on-surface tracking-tight">
                Accessibility Profile Questionnaire
              </h1>
              <p className="text-xs text-on-surface-variant font-medium">
                Select your mobility requirements and navigation preferences to tailor every route recommendation.
              </p>
            </div>

            {/* Persona Selector */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-black text-on-surface uppercase tracking-wider">
                1. Primary Mobility Persona
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'wheelchair', label: 'Wheelchair', icon: Accessibility, desc: 'Ramps & Lifts' },
                  { id: 'older-adult', label: 'Older Adult', icon: Footprints, desc: 'Low Slopes' },
                  { id: 'low-vision', label: 'Low Vision', icon: Eye, desc: 'Audio Alerts' },
                  { id: 'caregiver', label: 'Caregiver', icon: Heart, desc: 'Stroller Paths' },
                ].map(p => {
                  const Icon = p.icon;
                  const isSelected = selectedPersona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersona(p.id as PersonaType)}
                      className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary-container/20 border-primary text-on-surface shadow-xs ring-2 ring-primary/40'
                          : 'bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`} />
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary fill-primary text-white" />}
                      </div>
                      <span className="text-xs font-extrabold">{p.label}</span>
                      <span className="text-[10px] font-medium opacity-80">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobility Device Sub-Type */}
            <div className="flex flex-col gap-2">
              <label htmlFor="mobility-type" className="text-xs font-black text-on-surface uppercase tracking-wider">
                2. Mobility Device / Assistance Type
              </label>
              <select
                id="mobility-type"
                value={mobilityType}
                onChange={e => setMobilityType(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="electric-wheelchair">Power / Electric Wheelchair</option>
                <option value="manual-wheelchair">Manual Wheelchair</option>
                <option value="walker-crutches">Walker / Crutches Support</option>
                <option value="visually-impaired">Visually Impaired / White Cane</option>
                <option value="stroller">Stroller / Pram Access</option>
                <option value="walking">Unassisted Walking (Gentle Pace)</option>
              </select>
            </div>

            {/* Specific Needs Checkboxes */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-black text-on-surface uppercase tracking-wider">
                3. Detailed Route & Physical Preferences
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Step free */}
                <label className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 cursor-pointer hover:bg-surface-container transition-colors">
                  <input
                    type="checkbox"
                    checked={requireStepFree}
                    onChange={e => setRequireStepFree(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-on-surface">Step-Free Routes Only</span>
                    <span className="text-[11px] text-on-surface-variant">Strictly avoid all stairs, unramped steps & high curbs.</span>
                  </div>
                </label>

                {/* Avoid Stairs */}
                <label className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 cursor-pointer hover:bg-surface-container transition-colors">
                  <input
                    type="checkbox"
                    checked={avoidStairs}
                    onChange={e => setAvoidStairs(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-on-surface">Avoid Flight of Stairs</span>
                    <span className="text-[11px] text-on-surface-variant">Require elevators or escalators for level changes.</span>
                  </div>
                </label>

                {/* Lower slopes */}
                <label className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 cursor-pointer hover:bg-surface-container transition-colors">
                  <input
                    type="checkbox"
                    checked={preferLowerSlopes}
                    onChange={e => setPreferLowerSlopes(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-on-surface">Prefer Gentle Incline Slopes</span>
                    <span className="text-[11px] text-on-surface-variant">Reroute away from steep hills & intense ramps.</span>
                  </div>
                </label>

                {/* Safer crossings */}
                <label className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 cursor-pointer hover:bg-surface-container transition-colors">
                  <input
                    type="checkbox"
                    checked={preferSaferCrossings}
                    onChange={e => setPreferSaferCrossings(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-on-surface">Safer Signalized Crossings</span>
                    <span className="text-[11px] text-on-surface-variant">Prioritize intersections with audible/visual traffic signals.</span>
                  </div>
                </label>

                {/* Reduced distance */}
                <label className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 cursor-pointer hover:bg-surface-container transition-colors">
                  <input
                    type="checkbox"
                    checked={preferReducedDistance}
                    onChange={e => setPreferReducedDistance(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-on-surface">Reduced Physical Distance</span>
                    <span className="text-[11px] text-on-surface-variant">Optimize for shortest physical distance to conserve energy.</span>
                  </div>
                </label>

                {/* Audio Prompts */}
                <label className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-start gap-3 cursor-pointer hover:bg-surface-container transition-colors">
                  <input
                    type="checkbox"
                    checked={needAudioPrompts}
                    onChange={e => setNeedAudioPrompts(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-on-surface">Voice Spoken Guidance</span>
                    <span className="text-[11px] text-on-surface-variant">Enable audio turn alerts & obstacle warnings.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Maximum Slope Tolerance Slider */}
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <label htmlFor="slope-slider" className="text-xs font-extrabold text-on-surface">
                  Maximum Incline Slope Tolerance
                </label>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {maxSlopePercent}% max grade
                </span>
              </div>
              <input
                id="slope-slider"
                type="range"
                min="3"
                max="15"
                step="1"
                value={maxSlopePercent}
                onChange={e => setMaxSlopePercent(Number(e.target.value))}
                className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-on-surface-variant font-bold">
                <span>3% (Gentle / Easy)</span>
                <span>8% (Standard Ramp)</span>
                <span>15% (Steep Slope)</span>
              </div>
            </div>

            {/* Save CTA */}
            <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-bold text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                ← Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-13 px-8 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                <span>{isSubmitting ? 'Saving to Database...' : 'Save Preferences & Open Dashboard'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 4: COMPLETE & LAUNCH DASHBOARD
        ───────────────────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="p-8 md:p-10 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-full bg-secondary/15 text-secondary flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-black text-on-surface tracking-tight">
                Profile Saved & Personalized!
              </h1>
              <p className="text-xs text-on-surface-variant font-medium max-w-md">
                Your custom accessibility rule set is active. All maps, routes, and barrier alerts on your dashboard are now calibrated to your needs.
              </p>
            </div>

            <div className="w-full max-w-sm p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-left flex flex-col gap-2 text-xs font-semibold">
              <div className="flex items-center justify-between text-primary font-extrabold uppercase text-[11px]">
                <span>Active Profile Summary</span>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>👤 User: <strong>{user.name || 'Navigator User'}</strong></div>
              <div>♿ Mobility: <strong>{selectedPersona.toUpperCase()}</strong> ({mobilityType})</div>
              <div>📐 Slope Tolerance: <strong>≤ {maxSlopePercent}% grade</strong></div>
              <div>🚶 Constraints: <strong>{requireStepFree ? 'Step-Free Only' : 'Ramp Preferred'}</strong> · {preferSaferCrossings ? 'Safer Crossings' : 'Direct Path'}</div>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full max-w-sm h-13 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity cursor-pointer"
            >
              <span>Explore Personalized Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
