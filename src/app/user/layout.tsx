import React from 'react';
import UserSidebar from '@/components/UserSidebar';
import TalkToAssistantButton from '@/components/TalkToAssistantButton';

export default function UserPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
