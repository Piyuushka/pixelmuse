'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import Logo from './Logo';
import {
  ShieldCheck,
  MapPin,
  Users,
  BellRing,
  History,
  Sliders,
  LogOut,
  Sun,
  Moon,
  Radio,
  UserCheck,
  PlusCircle,
  Wifi,
  WifiOff,
  Loader2,
  Edit3,
} from 'lucide-react';

const caregiverNavItems = [
  { href: '/caregiver/map', label: 'Live Tracking Map', icon: MapPin },
  { href: '/caregiver/dependents', label: 'My Dependents', icon: Users },
  { href: '/caregiver/alerts', label: 'Alerts & SOS Log', icon: BellRing },
  { href: '/caregiver/history', label: 'Activity History', icon: History },
  { href: '/caregiver/settings', label: 'Safe Zones & Geofences', icon: Sliders },
];

interface ActiveDependentInfo {
  name: string;
  email: string;
  status: string;
}

export default function CaregiverSidebar() {
  const pathname = usePathname();
  const { isDarkMode, toggleDarkMode, speakText, user, logoutUser, fontScale, setFontScale } = useAccessibility();

  const [activeDependent, setActiveDependent] = useState<ActiveDependentInfo | null>(null);
  const [loadingDependent, setLoadingDependent] = useState<boolean>(true);
  const [profileName, setProfileName] = useState<string>(user?.name || '');
  const [profileRole, setProfileRole] = useState<string>('Parent / Caregiver');
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    async function fetchCaregiverProfile() {
      try {
        const res = await fetch('/api/caregiver/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.name) {
            setProfileName(data.user.name);
          }
          if (data.user?.relationship) {
            const relMap: Record<string, string> = {
              parent: 'Parent / Caregiver',
              guardian: 'Legal Guardian',
              family: 'Family Caregiver',
              professional_caregiver: 'Professional Caregiver',
            };
            setProfileRole(relMap[data.user.relationship] || 'Parent / Caregiver');
          }
        }
      } catch {
        // Quiet fallback
      }
    }
    fetchCaregiverProfile();
  }, [pathname, user?.name]);

  useEffect(() => {
    async function fetchActiveDependent() {
      try {
        const res = await fetch('/api/guardian/dashboard');
        if (res.ok) {
          const data = await res.json();
          if (data.dependents && data.dependents.length > 0) {
            setActiveDependent(data.dependents[0]);
          } else {
            setActiveDependent(null);
          }
        }
      } catch {
        // Quiet fallback
      } finally {
        setLoadingDependent(false);
      }
    }
    fetchActiveDependent();
  }, [pathname]);

  return (
    <aside className="w-72 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between h-screen sticky top-0 z-50 flex-shrink-0 shadow-sm overflow-y-auto">
      
      {/* Brand Header */}
      <div className="p-5 flex flex-col gap-4 border-b border-outline-variant/20">
        <Link href="/caregiver/map" className="flex items-center gap-3 group">
          <Logo size={44} className="group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="text-xl font-black text-on-surface leading-tight tracking-tight">
              PathFinder
            </span>
            <span className="text-[11px] text-primary font-extrabold tracking-wider uppercase">
              Caregiver Guardian Portal
            </span>
          </div>
        </Link>

        {/* Real Guardian Status Badge */}
        <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${activeDependent ? 'bg-emerald-500' : 'bg-surface-container-high'}`} />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-on-surface uppercase tracking-wider">
                {activeDependent ? 'Guardian Linked' : 'Standby Mode'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-medium">
                {activeDependent ? `Monitoring ${activeDependent.name}` : 'Awaiting dependent connection'}
              </span>
            </div>
          </div>
          <Radio className={`w-4 h-4 ${activeDependent ? 'text-primary animate-pulse' : 'text-on-surface-variant/40'}`} />
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-3 py-4 flex-1 flex flex-col gap-1">
        <div className="px-3 py-1 text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
          Guardian Navigation
        </div>

        {caregiverNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/caregiver/map' && pathname === '/caregiver');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3.5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-between group ${
                isActive
                  ? 'bg-primary text-on-primary shadow-md font-extrabold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-on-surface-variant group-hover:text-primary'}`} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* Real Active Dependent Status / Empty State */}
        <div className="mt-6 p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-on-surface-variant uppercase">
            <span>Active Dependent</span>
            {activeDependent && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                activeDependent.status === 'ONLINE' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {activeDependent.status === 'ONLINE' ? 'ONLINE' : 'LINKED'}
              </span>
            )}
          </div>

          {loadingDependent ? (
            <div className="py-2 flex items-center gap-2 text-xs text-on-surface-variant animate-pulse font-medium">
              <div className="w-6 h-6 rounded-full bg-surface-container-high" />
              <span>Checking connections...</span>
            </div>
          ) : activeDependent ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-xs font-black flex-shrink-0">
                {activeDependent.name ? activeDependent.name.charAt(0).toUpperCase() : 'D'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-on-surface truncate">
                  {activeDependent.name}
                </span>
                <span className="text-[10px] text-on-surface-variant truncate">
                  {activeDependent.email}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-1">
              <span className="text-xs text-on-surface-variant font-medium leading-relaxed">
                No dependents linked yet. Add one with a pairing code.
              </span>
              <Link
                href="/caregiver/dependents"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Dependent</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low flex flex-col gap-3">
        {/* Font Scaling Row */}
        <div className="flex items-center justify-between p-1 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
          <span className="text-xs font-bold text-on-surface-variant pl-2">Text Size</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setFontScale('sm');
                speakText('Text size compact');
              }}
              aria-label="Small compact text size"
              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-colors ${
                fontScale === 'sm' ? 'bg-primary text-on-primary font-extrabold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              T-
            </button>
            <button
              type="button"
              onClick={() => {
                setFontScale('md');
                speakText('Text size standard');
              }}
              aria-label="Medium standard text size"
              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-colors ${
                fontScale === 'md' ? 'bg-primary text-on-primary font-extrabold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              T
            </button>
            <button
              type="button"
              onClick={() => {
                setFontScale('lg');
                speakText('Text size large');
              }}
              aria-label="Large text size"
              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-colors ${
                fontScale === 'lg' ? 'bg-primary text-on-primary font-extrabold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              T+
            </button>
          </div>
        </div>

        {/* Night / Day toggle */}
        <button
          type="button"
          onClick={() => {
            toggleDarkMode();
            speakText(!isDarkMode ? 'Night mode enabled' : 'Day mode restored');
          }}
          className="w-full h-10 px-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/30 flex items-center justify-between text-xs font-bold text-on-surface cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {isDarkMode ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>{isDarkMode ? 'Night Theme' : 'Day Theme'}</span>
          </div>
          <span className="text-[10px] text-on-surface-variant font-extrabold uppercase">Toggle</span>
        </button>

        {/* Real Caregiver Account Profile in Footer */}
        <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-black flex-shrink-0">
              {profileName ? profileName.charAt(0).toUpperCase() : user?.name ? user.name.charAt(0).toUpperCase() : <UserCheck className="w-4 h-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold text-on-surface truncate">
                {profileName || user?.name || 'Caregiver'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-bold truncate">
                {profileRole}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Link
              href="/caregiver/profile-setup?edit=true"
              aria-label="Edit Profile"
              title="Edit Profile"
              className="w-10 h-10 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </Link>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={async () => {
                setIsLoggingOut(true);
                await logoutUser();
              }}
              aria-label="Log out of Caregiver Portal"
              title="Log out"
              className="min-w-[48px] min-h-[48px] w-12 h-12 rounded-xl bg-surface-container-high hover:bg-error/15 text-on-surface-variant hover:text-error flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LogOut className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

    </aside>
  );
}
