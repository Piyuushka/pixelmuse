/**
 * Haptic Feedback Cues for Accessible Navigation
 * Uses Web Vibration API (navigator.vibrate) to assist blind/visually impaired & mobile users.
 */

export type HapticCueType =
  | 'left_turn'
  | 'right_turn'
  | 'stop'
  | 'obstacle'
  | 'confirm'
  | 'error';

export const HAPTIC_PATTERNS: Record<HapticCueType, number[]> = {
  left_turn: [100, 50, 100],                         // 2 short pulses
  right_turn: [200, 80, 200, 80, 200],              // 3 medium pulses
  stop: [400, 100, 400],                             // 2 long pulses
  obstacle: [100, 50, 100, 50, 100, 50, 400],        // Warning pattern
  confirm: [60],                                     // Subtle tap
  error: [200, 100, 200],                            // Error buzz
};

/**
 * Triggers a haptic vibration pattern on supported mobile / touch devices.
 */
export function triggerHapticCue(cue: HapticCueType): boolean {
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
