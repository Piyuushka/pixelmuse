'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
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
} from 'lucide-react';

const caregiverNavItems = [
  { href: '/caregiver/map', label: 'Live Tracking Map', icon: MapPin, badge: 'REAL-TIME' },
  { href: '/caregiver/dependents', label: 'My Dependents', icon: Users },
  { href: '/caregiver/alerts', label: 'Alerts & SOS Log', icon: BellRing, badge: 'SAFETY' },
  { href: '/caregiver/history', label: 'Activity History', icon: History },
  { href: '/caregiver/settings', label: 'Safe Zones & Geofences', icon: Sliders },
];

export default function CaregiverSidebar() {
  const pathname = usePathname();
  const { isDarkMode, toggleDarkMode, speakText, user, logoutUser } = useAccessibility();

  return (
    <aside className="w-72 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between h-screen sticky top-0 z-50 flex-shrink-0 shadow-sm overflow-y-auto">
      
      {/* Brand Header */}
      <div className="p-5 flex flex-col gap-4 border-b border-outline-variant/20">
        <Link href="/caregiver/map" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
            <ShieldCheck className="w-6 h-6 fill-current text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-on-surface leading-tight tracking-tight">
              PathFinder
            </span>
            <span className="text-[11px] text-primary font-extrabold tracking-wider uppercase">
              Caregiver Guardian Portal
            </span>
          </div>
        </Link>

        {/* Live Guardian Status Badge */}
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-primary uppercase tracking-wider">
                Guardian Monitor
              </span>
              <span className="text-[10px] text-on-surface-variant font-semibold">
                Telemetry & SOS Guard Active
              </span>
            </div>
          </div>
          <Radio className="w-4 h-4 text-primary flex-shrink-0 animate-pulse" />
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-3 py-4 flex-1 flex flex-col gap-1">
        <div className="px-3 py-1 text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider">
          Guardian Dashboard
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

              {item.badge && (
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                    isActive ? 'bg-white/20 text-white' : 'bg-primary/15 text-primary'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Quick Switch / Active Dependent status */}
        <div className="mt-6 p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-on-surface-variant uppercase">
            <span>Active Dependent</span>
            <span className="text-[9px] text-secondary font-black px-1.5 py-0.5 rounded bg-secondary/15">ONLINE</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-xs font-black">
              AR
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-on-surface truncate">Alex Rivera</span>
              <span className="text-[10px] text-on-surface-variant truncate">alex.rivera@community.org</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low flex flex-col gap-3">
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

        {/* Caregiver Account */}
        <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-black">
              {user.name ? user.name.charAt(0).toUpperCase() : <UserCheck className="w-4 h-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold text-on-surface truncate">
                {user.name || 'Caregiver Account'}
              </span>
              <span className="text-[10px] text-primary font-black uppercase">
                Parent Role
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={logoutUser}
            aria-label="Log out"
            className="p-2 rounded-xl bg-surface-container-high hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

    </aside>
  );
}
