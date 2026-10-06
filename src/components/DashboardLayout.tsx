'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import AccessibilityNavHeader from '@/components/AccessibilityNavHeader';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex w-full min-h-screen bg-surface text-on-surface">
      {/* Persistent Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area with Header & Container Frame */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <AccessibilityNavHeader />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
