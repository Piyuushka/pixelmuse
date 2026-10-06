'use client';

import React, { useState } from 'react';
import { useAccessibility, PersonaType } from '@/context/AccessibilityContext';
import {
  MapPin,
  Search,
  Mic,
  MicOff,
  Accessibility,
  Footprints,
  Eye,
  Heart,
  Check,
  ArrowRight,
} from 'lucide-react';

export interface RouteFormValues {
  destination: string;
  persona: PersonaType;
  preferences: {
    stepFree: boolean;
    lowSlope: boolean;
    wellLit: boolean;
    saferCrossings: boolean;
  };
  maxSlope: number;
}

interface RoutePlannerFormProps {
  onSubmitForm: (values: RouteFormValues) => void;
}

export default function RoutePlannerForm({ onSubmitForm }: RoutePlannerFormProps) {
  const { persona, setPersona, speakText } = useAccessibility();

  // Search input state
  const [searchQuery, setSearchQuery] = useState('Cardiology Dept');
  const [isListening, setIsListening] = useState(false);

  // Section 2: Route Preferences state
  const [preferences, setPreferences] = useState({
    stepFree: true,
    lowSlope: true,
    wellLit: true,
    saferCrossings: false,
  });

  // Section 3: Maximum Slope Gradient state (1% to 12%, default 5%)
  const [maxSlope, setMaxSlope] = useState(5);

  // Section 1 Travelling Roles definition
  const roles: {
    id: PersonaType;
    title: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      id: 'wheelchair',
      title: 'Wheelchair',
      description: 'Elevator & ramp priority',
      icon: Accessibility,
    },
    {
      id: 'older-adult',
      title: 'Older Adult',
      description: 'Rest points & low stairs',
      icon: Footprints,
    },
    {
      id: 'low-vision',
      title: 'Low Vision',
      description: 'Audio guidance & high contrast',
      icon: Eye,
    },
    {
      id: 'caregiver',
      title: 'Caregiver',
      description: 'Wide doors & stroller access',
      icon: Heart,
    },
  ];

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: !prev[key] };
      const labels: Record<string, string> = {
        stepFree: 'Step-free access',
        lowSlope: 'Low slope',
        wellLit: 'Well-lit streets',
        saferCrossings: 'Safer crossings',
      };
      speakText(`${labels[key]} preference ${next[key] ? 'selected' : 'unselected'}`);
      return next;
    });
  };

  const handleVoiceDictation = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setIsListening(true);
      speakText("Listening for destination... e.g. Cardiology Dept");
      setTimeout(() => {
        setSearchQuery("Cardiology Dept - Main Pavilion");
        setIsListening(false);
        speakText("Destination captured: Cardiology Dept Main Pavilion");
      }, 2000);
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        speakText("Voice dictation active. State your destination.");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        speakText(`Destination recognized: ${transcript}`);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        speakText("Voice recognition failed. Using default destination.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    speakText(
      `Calculating accessible route to ${searchQuery || 'Cardiology Dept'} for ${persona} persona with ${maxSlope}% max slope.`
    );
    onSubmitForm({
      destination: searchQuery || 'Cardiology Dept',
      persona,
      preferences,
      maxSlope,
    });
  };

  return (
    <main
      className="min-h-[calc(100vh-65px)] w-full py-8 px-4 sm:px-6 lg:px-8 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-200"
      id="route-planner-container"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 relative">
        
        {/* Header */}
        <div className="mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center sm:items-start gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-xs">
            <MapPin className="w-7 h-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Route Planner
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 font-medium">
              Plan an accessible journey tailored to your needs.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" aria-label="Route Planner Form">
          
          {/* Search Input */}
          <div className="space-y-2">
            <label
              htmlFor="destination-input"
              className="block text-sm font-extrabold text-slate-900 dark:text-slate-100"
            >
              Destination
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-purple-600 dark:text-purple-400 pointer-events-none">
                <Search className="w-5 h-5" aria-hidden="true" />
              </div>
              <input
                id="destination-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., Cardiology Dept"
                className="w-full pl-12 pr-14 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-full text-slate-900 dark:text-white placeholder-slate-400 font-semibold text-base focus:outline-none focus:border-purple-600 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={handleVoiceDictation}
                aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation for destination'}
                className={`absolute right-3 p-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Mic className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Section 1: "I am travelling as:" */}
          <section className="space-y-3" aria-labelledby="travel-role-heading">
            <h2
              id="travel-role-heading"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <span>I am travelling as:</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {roles.map((role) => {
                const isSelected = persona === role.id;
                const IconComponent = role.icon;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setPersona(role.id);
                      speakText(`Selected travel mode: ${role.title}`);
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Select ${role.title} persona mode`}
                    className={`p-4 rounded-2xl text-left transition-all duration-200 flex items-start gap-3.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/40 ${
                      isSelected
                        ? 'border-2 border-purple-600 bg-purple-50/80 dark:bg-purple-950/60 ring-2 ring-purple-500/20 shadow-sm'
                        : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-purple-100 text-purple-700 dark:bg-slate-700 dark:text-purple-300'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-base text-slate-900 dark:text-white">
                        <span>{role.title}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-purple-600" aria-hidden="true" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {role.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: "Route Preferences" */}
          <section className="space-y-3" aria-labelledby="route-preferences-heading">
            <h2
              id="route-preferences-heading"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
            >
              Route Preferences
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                { key: 'stepFree', label: 'Step-free access' },
                { key: 'lowSlope', label: 'Low slope' },
                { key: 'wellLit', label: 'Well-lit streets' },
                { key: 'saferCrossings', label: 'Safer crossings' },
              ].map(({ key, label }) => {
                const isChecked = preferences[key as keyof typeof preferences];
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none focus-within:ring-2 focus-within:ring-purple-600 ${
                      isChecked
                        ? 'border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {/* Custom Purple Square Checkbox */}
                    <div className="relative flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePreference(key as keyof typeof preferences)}
                        aria-label={label}
                        className="sr-only"
                      />
                      <div
                        className={`w-6 h-6 rounded-lg transition-all flex items-center justify-center border-2 ${
                          isChecked
                            ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />}
                      </div>
                    </div>

                    <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Section 3: "Maximum Slope Gradient" */}
          <section className="space-y-4 pt-2" aria-labelledby="slope-gradient-heading">
            <div className="flex items-center justify-between">
              <h2
                id="slope-gradient-heading"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                Maximum Slope Gradient
              </h2>

              {/* Dynamic Percentage text displayed above right side in purple text */}
              <span
                id="slope-value-display"
                className="text-lg font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800"
                aria-live="polite"
              >
                {maxSlope}%
              </span>
            </div>

            <div className="space-y-2">
              <input
                id="slope-range-slider"
                type="range"
                min="1"
                max="12"
                step="1"
                value={maxSlope}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxSlope(val);
                }}
                aria-labelledby="slope-gradient-heading"
                aria-valuemin={1}
                aria-valuemax={12}
                aria-valuenow={maxSlope}
                aria-valuetext={`${maxSlope} percent maximum slope`}
                className="w-full cursor-pointer accent-purple-slider"
                style={{
                  background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${
                    ((maxSlope - 1) / 11) * 100
                  }%, #e9d5ff ${((maxSlope - 1) / 11) * 100}%, #e9d5ff 100%)`,
                }}
              />

              <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-0.5">
                <span>Flat (1%)</span>
                <span>Steep (12%)</span>
              </div>
            </div>
          </section>

          {/* Call to Action Button */}
          <div className="pt-4">
            <button
              type="submit"
              id="find-route-btn"
              className="w-full py-4 px-8 rounded-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-base sm:text-lg tracking-wide shadow-lg shadow-purple-700/25 hover:shadow-xl hover:shadow-purple-700/35 flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-400"
            >
              <span>Find Accessible Route</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
