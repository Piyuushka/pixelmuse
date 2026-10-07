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
      <main id="main-content" tabIndex={-1} className="w-full min-h-screen bg-surface text-on-surface outline-none">
        {children}
      </main>
    );
  }

  return (
    <div className="flex w-full min-h-screen bg-surface text-on-surface">
      <UserSidebar />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto min-h-screen outline-none">
        {children}
      </main>
      <TalkToAssistantButton variant="fab" />
    </div>
  );
}
