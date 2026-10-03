/**
 * Haptic Feedback Cues for Accessible Navigation
 * Uses Capacitor Haptics plugin on native platforms,
 * falls back to Web Vibration API (navigator.vibrate) on browsers.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativePlatform, isPluginAvailable } from './capacitor-platform';

export type HapticCueType =
  | 'left_turn'
  | 'right_turn'
  | 'stop'
  | 'obstacle'
  | 'confirm'
  | 'error';

/** Web Vibration API fallback patterns (milliseconds) */
export const HAPTIC_PATTERNS: Record<HapticCueType, number[]> = {
  left_turn: [100, 50, 100],                         // 2 short pulses
  right_turn: [200, 80, 200, 80, 200],              // 3 medium pulses
  stop: [400, 100, 400],                             // 2 long pulses
  obstacle: [100, 50, 100, 50, 100, 50, 400],        // Warning pattern
  confirm: [60],                                     // Subtle tap
  error: [200, 100, 200],                            // Error buzz
};

/**
 * Maps our cue types to Capacitor's native haptic APIs for richer feedback.
 */
async function triggerNativeHaptic(cue: HapticCueType): Promise<boolean> {
  try {
    switch (cue) {
      case 'confirm':
        await Haptics.impact({ style: ImpactStyle.Light });
        return true;
      case 'left_turn':
        await Haptics.impact({ style: ImpactStyle.Medium });
        return true;
      case 'right_turn':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        // Double impact for right turn distinction
        setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 150);
        return true;
      case 'stop':
        await Haptics.notification({ type: NotificationType.Warning });
        return true;
      case 'obstacle':
        await Haptics.notification({ type: NotificationType.Error });
        return true;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        return true;
      default:
        await Haptics.impact({ style: ImpactStyle.Medium });
        return true;
    }
  } catch {
    return false;
  }
}

/**
 * Triggers a haptic vibration pattern on supported devices.
 * Prefers native Capacitor Haptics on mobile, falls back to Web Vibration API.
 */
export function triggerHapticCue(cue: HapticCueType): boolean {
  // Try native Capacitor Haptics first
  if (isNativePlatform() && isPluginAvailable('Haptics')) {
    triggerNativeHaptic(cue); // async, fire-and-forget
    return true;
  }

  // Web fallback using Vibration API
  if (typeof window === 'undefined' || !('vibrate' in navigator)) {
    return false;
  }
  try {
    const pattern = HAPTIC_PATTERNS[cue] || HAPTIC_PATTERNS.confirm;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
