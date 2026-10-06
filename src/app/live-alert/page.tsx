'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LiveAlertRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const reportId = searchParams.get('reportId');
    const query = reportId ? `?reportId=${encodeURIComponent(reportId)}` : '';
    router.replace(`/live-adaptation-alert${query}`);
  }, [router, searchParams]);

  return (
    <div className="w-full h-screen flex items-center justify-center p-8 bg-surface text-on-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-bold text-on-surface-variant">
          Redirecting to Live Adaptation Alert...
        </p>
      </div>
    </div>
  );
}

export default function LiveAlertRedirect() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-bold text-on-surface-variant">Loading...</div>}>
      <LiveAlertRedirectContent />
    </Suspense>
  );
}
