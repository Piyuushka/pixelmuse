'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccessibility, PersonaType } from '@/context/AccessibilityContext';
import Logo from './Logo';
import {
  Navigation,
  MapPin,
  AlertTriangle,
  Users,
  Share2,
  AlertOctagon,
  Accessibility,
  Footprints,
  Eye,
  Heart,
  User,
  ShieldCheck,
  LogOut,
  Sliders,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const userNavItems = [
  { href: '/user/map', label: 'GPS Precision Map', icon: MapPin, badge: '±0.5M ACCURACY' },
  { href: '/user/alerts', label: 'Live Alerts', icon: AlertTriangle, alert: true },
  { href: '/user/community', label: 'Community Confidence', icon: Users },
  { href: '/user/share', label: 'Share My Location', icon: Share2, badge: 'PAIR CODE' },
  { href: '/user/sos', label: 'SOS Panic & Hotlines', icon: AlertOctagon, alert: true },
];

export default function UserSidebar() {
  const pathname = usePathname();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const {
    isDarkMode,
    toggleDarkMode,
    fontScale,
    setFontScale,
    isVoicePromptActive,
    toggleVoicePrompt,
    persona,
    setPersona,
    simulatedObstacle,
    speakText,
    user,
    openOnboarding,
    logoutUser,
  } = useAccessibility();

  const personas: { id: PersonaType; title: string; icon: React.ElementType }[] = [
    { id: 'wheelchair', title: 'Wheelchair', icon: Accessibility },
    { id: 'older-adult', title: 'Older Adult', icon: Footprints },
    { id: 'low-vision', title: 'Low Vision', icon: Eye },
    { id: 'caregiver', title: 'Companion', icon: Heart },
  ];

  return (
    <aside className="w-72 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between h-screen sticky top-0 z-50 flex-shrink-0 shadow-sm overflow-y-auto">
      
      {/* Top Brand Header */}
      <div className="p-5 flex flex-col gap-4 border-b border-outline-variant/20">
        <Link href="/user/map" className="flex items-center gap-3 group">
          <Logo size={44} className="group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="text-xl font-black text-on-surface leading-tight tracking-tight">
              PathFinder
            </span>
            <span className="text-[11px] text-on-surface-variant font-bold tracking-wider uppercase">
              Navigator Portal
            </span>
          </div>
        </Link>

        {/* GPS Status Badge */}
        <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
            <div className="flex flex-col">
              <span className="text-[11px] font-extrabold text-secondary uppercase tracking-wider">
                High Precision GPS
              </span>
              <span className="text-[10px] text-on-surface-variant font-semibold">
                Live Barrier-Free Routing
              </span>
            </div>
          </div>
          <ShieldCheck className="w-4 h-4 text-secondary flex-shrink-0" />
        </div>
      </div>

      {/* Navigation Pages */}
      <div className="px-3 py-4 flex-1 flex flex-col gap-1">
        <div className="px-3 py-1 text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
          Navigator Menu
        </div>

        {userNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/user/map' && pathname === '/user');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3.5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-between group ${
                isActive
                  ? 'bg-primary-container text-on-primary-container shadow-md font-extrabold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-on-surface-variant group-hover:text-primary'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-secondary text-on-secondary uppercase">
                  {item.badge}
                </span>
              )}

              {item.alert && simulatedObstacle?.active && (
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
              )}
            </Link>
          );
        })}

        {/* Mobility Mode Selector in Sidebar */}
        <div className="mt-4 px-3 py-1 text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
          Mobility Profile
        </div>
        <div className="grid grid-cols-2 gap-1.5 px-1">
          {personas.map((p) => {
            const Icon = p.icon;
            const isSelected = persona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPersona(p.id);
                  speakText(`Mobility profile set to ${p.title}`);
                }}
                className={`p-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-surface-container-low border-transparent text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accessibility Toolbar Controls */}
      <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low flex flex-col gap-3">
        <div className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
          <span>Accessibility Toolbar</span>
          <span className="text-[10px] text-secondary font-bold">WCAG AAA</span>
        </div>

        {/* Night Mode & Voice Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              toggleDarkMode();
              speakText(!isDarkMode ? "Night mode enabled" : "Day mode restored");
            }}
            id="sidebar-night-mode-toggle"
            aria-label={`Toggle Theme Mode. Currently ${isDarkMode ? 'Night Mode' : 'Day Mode'}`}
            aria-pressed={isDarkMode}
            className={`h-10 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              isDarkMode
                ? 'bg-primary text-white shadow-sm ring-1 ring-primary/40'
                : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
            }`}
          >
            {isDarkMode ? <Moon className="w-3.5 h-3.5 text-white" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
            <span className="text-xs">{isDarkMode ? 'Night' : 'Day'}</span>
          </button>

          <button
            type="button"
            onClick={toggleVoicePrompt}
            className={`h-10 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              isVoicePromptActive
                ? 'bg-secondary text-on-secondary shadow-sm'
                : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
            }`}
          >
            {isVoicePromptActive ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="text-xs">Voice</span>
          </button>
        </div>

        {/* Font Scaling Row */}
        <div className="flex items-center justify-between p-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
          <span className="text-xs font-bold text-on-surface-variant pl-2">Text Size</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontScale('sm')}
              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                fontScale === 'sm' ? 'bg-primary-container text-on-primary-container font-extrabold' : 'text-on-surface-variant'
              }`}
            >
              T-
            </button>
            <button
              onClick={() => setFontScale('md')}
              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                fontScale === 'md' ? 'bg-primary-container text-on-primary-container font-extrabold' : 'text-on-surface-variant'
              }`}
            >
              T
            </button>
            <button
              onClick={() => setFontScale('lg')}
              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                fontScale === 'lg' ? 'bg-primary-container text-on-primary-container font-extrabold' : 'text-on-surface-variant'
              }`}
            >
              T+
            </button>
          </div>
        </div>

        {/* User Account */}
        <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-black flex-shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-on-surface truncate">
                  {user.name || 'Navigator'}
                </span>
                <span className="text-[10px] text-on-surface-variant font-bold truncate">
                  User (Dependent)
                </span>
              </div>
            </div>

            <Link
              href="/user/profile-setup?edit=true"
              aria-label="Edit accessibility profile"
              title="Edit Profile"
              className="p-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary transition-colors cursor-pointer flex-shrink-0"
            >
              <Sliders className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <Link
              href="/user/profile-setup?edit=true"
              className="flex-1 py-2 px-2.5 rounded-xl bg-primary/10 text-primary text-[11px] font-extrabold hover:bg-primary/20 transition-colors text-center cursor-pointer"
            >
              Profile Settings
            </Link>

            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              aria-label="Log out of User Portal"
              title="Log out"
              className="min-w-[48px] min-h-[48px] w-12 h-12 rounded-xl bg-surface-container-high hover:bg-error/15 text-on-surface-variant hover:text-error flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Accessible Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-desc"
            className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-error/15 text-error flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h2 id="logout-title" className="text-base font-black text-on-surface">
                  Log out of PathFinder?
                </h2>
                <span className="text-[11px] text-error font-bold uppercase tracking-wider">
                  Live Sharing Will Stop
                </span>
              </div>
            </div>

            <p id="logout-desc" className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Logging out will stop live location sharing with your caregiver and pause active telemetry updates.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                disabled={isLoggingOut}
                className="flex-1 h-11 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface font-extrabold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={async () => {
                  setIsLoggingOut(true);
                  await logoutUser();
                }}
                className="flex-1 h-11 rounded-xl bg-error text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Confirm Logout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}
