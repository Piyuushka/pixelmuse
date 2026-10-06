'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import UserSidebar from '@/components/UserSidebar';
import TalkToAssistantButton from '@/components/TalkToAssistantButton';

export default function UserPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isProfileSetup = pathname === '/user/profile-setup';

  if (isProfileSetup) {
    return (
      <main className="w-full min-h-screen bg-surface text-on-surface">
        {children}
      </main>
    );
  }

  return (
    <div className="flex w-full min-h-screen bg-surface text-on-surface">
      <UserSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto min-h-screen">
        {children}
      </main>
      <TalkToAssistantButton variant="fab" />
    </div>
  );
}
