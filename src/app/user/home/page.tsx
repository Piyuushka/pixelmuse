'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UserHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/user/map');
  }, [router]);

  return (
    <div className="w-full min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
