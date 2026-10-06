'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Volume2,
  ShieldCheck,
  Navigation,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

interface GuidedPageTourProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  targetId: string;
  title: string;
  text: string;
  icon: React.ElementType;
}

export default function GuidedPageTour({ isOpen, onClose }: GuidedPageTourProps) {
  const { speakText } = useAccessibility();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const steps: TourStep[] = [
    {
      targetId: 'top-nav-bar',
      title: 'Accessibility Controls',
      text: 'Adjust text size, toggle high-contrast themes, or turn on Voice narration anytime up here.',
      icon: Navigation,
    },
    {
      targetId: 'route-details-card',
      title: 'Your Custom Route',
      text: 'Here is your calculated route. We have applied your preferences for step-free access and low slopes.',
      icon: Sliders,
    },
    {
      targetId: 'map-hazard-alert',
      title: 'Live Adaptation Alerts',
      text: 'If an elevator breaks or a path is blocked, we will alert you and reroute you instantly.',
      icon: AlertTriangle,
    },
  ];

  const currentStep = steps[currentStepIndex];

  // Announce step change to screen readers and speech synthesis
  useEffect(() => {
    if (isOpen && currentStep) {
      const announcement = `Tour step ${currentStepIndex + 1} of ${steps.length}: ${currentStep.title}. ${currentStep.text}`;
      speakText(announcement);

      // Focus the next button for keyboard users
      setTimeout(() => {
        nextBtnRef.current?.focus();
      }, 100);

      // Highlight target element on DOM
      const targetEl = document.getElementById(currentStep.targetId);
      if (targetEl) {
        targetEl.classList.add('tour-spotlight-active');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      return () => {
        if (targetEl) {
          targetEl.classList.remove('tour-spotlight-active');
        }
      };
    }
  }, [isOpen, currentStepIndex, currentStep, speakText, steps.length]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      speakText("Guided tour completed! You are ready to explore your accessible path.");
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    speakText("Tour skipped.");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      aria-describedby="tour-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Dimmed Background Backdrop (Spotlight Effect) */}
      <div
        className="fixed inset-0 bg-purple-950/70 backdrop-blur-xs transition-opacity duration-300"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Screen Reader ARIA Live Step Counter */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Tour step ${currentStepIndex + 1} of ${steps.length}: ${currentStep.title}. ${currentStep.text}`}
      </div>

      {/* Tooltip Dialog Card (White background, deep purple buttons, large clear text) */}
      <div
        ref={dialogRef}
        className="relative z-50 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-950/40 border-2 border-purple-500/30 text-slate-900 dark:text-white transition-all transform scale-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/40 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30">
              <currentStep.icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <h2
                id="tour-modal-title"
                className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-purple-50"
              >
                {currentStep.title}
              </h2>
            </div>
          </div>

          <button
            onClick={handleSkip}
            aria-label="Close guided tour"
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-purple-200 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body Text (Large & Clear Typography) */}
        <div className="mb-8">
          <p
            id="tour-modal-desc"
            className="text-base sm:text-lg font-medium text-slate-700 dark:text-purple-100 leading-relaxed"
          >
            {currentStep.text}
          </p>
        </div>

        {/* Action Controls (Large Easily Tappable Buttons) */}
        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          {/* Skip Button */}
          <button
            type="button"
            onClick={handleSkip}
            className="px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-purple-300 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-600"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {/* Previous Button */}
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="px-4 py-2.5 rounded-full bg-purple-100 hover:bg-purple-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-purple-900 dark:text-purple-200 text-sm font-extrabold flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-purple-600"
                aria-label="Go to previous tour step"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Previous</span>
              </button>
            )}

            {/* Primary Deep Purple Next / Finish Button */}
            <button
              ref={nextBtnRef}
              type="button"
              onClick={handleNext}
              className="px-6 py-3 rounded-full bg-purple-700 hover:bg-purple-800 text-white text-sm font-extrabold flex items-center gap-2 shadow-md shadow-purple-700/30 transition-all focus:outline-none focus:ring-4 focus:ring-purple-400 active:scale-95"
              aria-label={currentStepIndex < steps.length - 1 ? "Next tour step" : "Finish tour"}
            >
              <span>{currentStepIndex < steps.length - 1 ? 'Next' : 'Got it!'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Progress Step Indicators */}
        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-purple-100 dark:border-purple-900/30">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStepIndex(idx)}
              aria-label={`Jump to tour step ${idx + 1}`}
              className={`h-2.5 rounded-full transition-all ${
                idx === currentStepIndex
                  ? 'w-8 bg-purple-600'
                  : 'w-2.5 bg-purple-200 dark:bg-slate-700 hover:bg-purple-400'
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
