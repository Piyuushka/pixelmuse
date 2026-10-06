'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportBarrierRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/community-confidence?action=report');
  }, [router]);

  return (
    <div className="w-full h-screen flex items-center justify-center p-8 bg-surface text-on-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-bold text-on-surface-variant">
          Redirecting to Community Confidence Barrier Report...
        </p>
      </div>
    </div>
  );
}
