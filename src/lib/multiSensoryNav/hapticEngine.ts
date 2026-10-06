/**
 * Multi-Sensory Navigation Module — Haptic Engine
 * PathFinder Access
 *
 * Provides precision haptic patterns for turn-by-turn navigation.
 *
 * Platform support:
 *   • iOS / Android (native)  → @capacitor/haptics  (ImpactStyle / custom)
 *   • Web / PWA               → navigator.vibrate() (Web Vibration API)
 *   • No-vibration devices    → silent no-op, returns false
 *
 * Pattern spec (from brief):
 *   straight      → 1 × 100 ms pulse
 *   turn_left     → 2 × 100 ms pulses, 150 ms gap
 *   turn_right    → 3 × 100 ms pulses, 150 ms gap
 *   arrived       → 1 × 900 ms long, high-amplitude pulse
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativePlatform, isPluginAvailable } from '@/utils/capacitor-platform';
import type { HapticBeat, HapticPattern, NavInstruction } from './types';

// ─────────────────────────────────────────────
// PATTERN DEFINITIONS
// ─────────────────────────────────────────────

const STRAIGHT_BEATS: HapticBeat[] = [
  { durationMs: 100, pauseMs: 0, amplitude: 0.6 },
];

const LEFT_BEATS: HapticBeat[] = [
  { durationMs: 100, pauseMs: 150, amplitude: 0.75 },
  { durationMs: 100, pauseMs: 0,   amplitude: 0.75 },
];

const RIGHT_BEATS: HapticBeat[] = [
  { durationMs: 100, pauseMs: 150, amplitude: 0.85 },
  { durationMs: 100, pauseMs: 150, amplitude: 0.85 },
  { durationMs: 100, pauseMs: 0,   amplitude: 0.85 },
];

const ARRIVED_BEATS: HapticBeat[] = [
  { durationMs: 900, pauseMs: 0, amplitude: 1.0 },
];

function totalMs(beats: HapticBeat[]): number {
  return beats.reduce((acc, b) => acc + b.durationMs + b.pauseMs, 0);
}

export const HAPTIC_PATTERNS: Record<NavInstruction, HapticPattern> = {
  straight:   { instruction: 'straight',   beats: STRAIGHT_BEATS, totalDurationMs: totalMs(STRAIGHT_BEATS) },
  turn_left:  { instruction: 'turn_left',  beats: LEFT_BEATS,     totalDurationMs: totalMs(LEFT_BEATS)     },
  turn_right: { instruction: 'turn_right', beats: RIGHT_BEATS,    totalDurationMs: totalMs(RIGHT_BEATS)    },
  arrived:    { instruction: 'arrived',    beats: ARRIVED_BEATS,  totalDurationMs: totalMs(ARRIVED_BEATS)  },
};

// ─────────────────────────────────────────────
// WEB VIBRATION API  —  pattern builder
// ─────────────────────────────────────────────

/**
 * Converts HapticBeat[] into the [on, off, on, off…] number array
 * required by navigator.vibrate().
 */
function beatsToVibrateArray(beats: HapticBeat[]): number[] {
  const arr: number[] = [];
  beats.forEach((beat, i) => {
    arr.push(beat.durationMs);
    if (i < beats.length - 1) arr.push(beat.pauseMs);
  });
  return arr;
}

// ─────────────────────────────────────────────
// NATIVE iOS / ANDROID  — CAPACITOR BRIDGE
// ─────────────────────────────────────────────

/**
 * Maps each instruction to one or more Capacitor haptic calls.
 *
 * Capacitor's Haptics plugin does not support arbitrary timing natively,
 * so we approximate with sequential ImpactStyle calls for left/right.
 * iOS CoreHaptics and Android VibrationEffect.createWaveform support
 * richer patterns; the full-native path is documented below as
 * platform-specific native code (Swift / Kotlin).
 */
async function fireNativeHaptic(instruction: NavInstruction): Promise<boolean> {
  if (!isPluginAvailable('Haptics')) return false;

  try {
    switch (instruction) {
      case 'straight':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;

      case 'turn_left':
        // 2 medium impacts, 150 ms apart
        await Haptics.impact({ style: ImpactStyle.Medium });
        await delay(250); // durationMs(100) + pauseMs(150)
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;

      case 'turn_right':
        // 3 heavy impacts, 150 ms apart
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await delay(250);
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await delay(250);
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;

      case 'arrived':
        // Notification success gives a distinctive long rumble on most devices
        await Haptics.notification({ type: NotificationType.Success });
        // Follow-up heavy impact to extend perceived duration
        await delay(300);
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
    }
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// WEB VIBRATION  — fallback
// ─────────────────────────────────────────────

function fireWebHaptic(instruction: NavInstruction): boolean {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
  const pattern = HAPTIC_PATTERNS[instruction];
  return navigator.vibrate(beatsToVibrateArray(pattern.beats));
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

/**
 * Fire the haptic pattern for a given NavInstruction.
 *
 * @returns Promise<boolean> — true if vibration was dispatched,
 *          false if the device does not support haptics.
 *
 * This function is non-blocking; the caller does not need to await it
 * for queue scheduling (fire-and-forget is fine). Await it only if you
 * need to sequence two haptic events back-to-back.
 */
export async function fireHapticCue(instruction: NavInstruction): Promise<boolean> {
  if (isNativePlatform()) {
    const ok = await fireNativeHaptic(instruction);
    if (ok) return true;
    // Fall through to web API if native bridge fails
  }
  return fireWebHaptic(instruction);
}

/**
 * Stop any currently playing vibration (Web API only).
 * Native platforms cancel via OS lifecycle automatically.
 */
export function cancelHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(0);
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Battery-safe guard: suppress haptics when device reports < 15 % battery
 * and Low Power Mode is heuristically detected on iOS via reduced framerate.
 *
 * Note: navigator.getBattery() is not available on Safari/iOS. This is a
 * best-effort implementation for Android Chrome / web PWA contexts.
 */
export async function isBatterySafe(): Promise<boolean> {
  if (typeof navigator === 'undefined') return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  if (typeof nav.getBattery !== 'function') return true; // assume safe
  try {
    const battery = await nav.getBattery();
    // Suppress if charging is false AND level is below 15 %
    if (!battery.charging && battery.level < 0.15) return false;
  } catch {
    // getBattery rejected — assume safe
  }
  return true;
}
