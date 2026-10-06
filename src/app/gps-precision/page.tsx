'use client';

import React, { Suspense } from 'react';
import UnifiedRoutePlanner from '@/components/UnifiedRoutePlanner';

export default function GpsPrecisionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-on-surface-variant font-medium">Loading Route Planner...</div>}>
      <UnifiedRoutePlanner initialMode="gps" />
    </Suspense>
  );
}
