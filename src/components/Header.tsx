'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import { 
  CheckCircle2, 
  Navigation, 
  Map, 
  Radio, 
  Compass, 
  Users, 
  AlertTriangle, 
  PlusCircle, 
  User,
  Sliders,
  ShieldCheck
} from 'lucide-react';

const navItems = [
  { href: '/gps-precision', label: 'GPS Precision Map', icon: Map },
  { href: '/micro-navigation', label: 'Micro-Navigation', icon: Compass },
  { href: '/safety-routing', label: 'Parental Control & Safety', icon: ShieldCheck },
  { href: '/live-adaptation-alert', label: 'Live Alert', icon: AlertTriangle },
  { href: '/community-confidence', label: 'Community Confidence', icon: Users },
];

export default function Header() {
  const pathname = usePathname();
  const { user, openOnboarding } = useAccessibility();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-b border-outline-variant/30 shadow-xs">
      <div className="h-20 max-w-[1300px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
        
        {/* Brand Section */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Navigation className="w-6 h-6 fill-current text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold text-on-surface leading-tight tracking-tight">
              PathFinder Access
            </span>
            <span className="text-[11px] text-on-surface-variant font-medium tracking-wide uppercase">
              Barrier-Free Nav Core
            </span>
          </div>
        </Link>

        {/* Accessibility Status Badges */}
        <div className="hidden xl:flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-on-secondary text-xs font-semibold shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>WCAG AAA ACTIVE</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant/40">
            <Navigation className="w-3.5 h-3.5 text-primary" />
            <span>GPS HIGH PRECISION</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="hidden lg:flex items-center gap-1 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/30">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-on-surface-variant'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile & Mobile Nav */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={openOnboarding}
            aria-label="User profile & accessibility settings"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-on-primary shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer text-xs font-bold"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">
              {user.isLoggedIn ? (user.name || 'Profile') : 'Log In / Setup'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer Row */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 bg-surface-container-low border-t border-outline-variant/20 scrollbar-none gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-bold'
                  : 'text-on-surface-variant bg-surface-container hover:bg-surface-container-high'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
