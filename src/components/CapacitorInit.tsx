/**
 * CapacitorInit — Root-level component that bootstraps all native features.
 * Mount this ONCE inside <AccessibilityProvider> in layout.tsx.
 * On web browsers it is a no-op. On iOS/Android it wires up:
 *   - Status bar theming
 *   - Splash screen hide
 *   - Network monitoring
 *   - Push notification registration
 *   - Keyboard height tracking
 *   - Android back button
 */
'use client';

import { useEffect } from 'react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { isNativePlatform } from '@/utils/capacitor-platform';

interface CapacitorInitProps {
  /** Called when native network status changes — wire into your offline queue */
  onNetworkChange?: (isOnline: boolean) => void;
}

export default function CapacitorInit({ onNetworkChange }: CapacitorInitProps) {
  const { isOnline, pushToken } = useNativeFeatures();

  // Propagate network changes to parent (e.g., AccessibilityContext offline queue)
  useEffect(() => {
    onNetworkChange?.(isOnline);
  }, [isOnline, onNetworkChange]);

  useEffect(() => {
    if (pushToken && isNativePlatform()) {
      console.log('[CapacitorInit] Push token ready:', pushToken.slice(0, 10) + '...');
      // TODO: Register this token with your backend for targeted alerts
    }
  }, [pushToken]);

  // This component renders nothing — it only triggers side effects
  return null;
}
