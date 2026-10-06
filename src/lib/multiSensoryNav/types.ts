/**
 * Multi-Sensory Navigation Module — Shared Types
 * PathFinder Access
 *
 * Covers haptic patterns, spatial audio, geofence waypoints,
 * navigation queue events, and headphone state.
 */

import { Coordinates } from '@/lib/spatial';

// ─────────────────────────────────────────────
// NAVIGATION INSTRUCTION TYPES
// ─────────────────────────────────────────────

/** The four core turn-by-turn instruction cues */
export type NavInstruction =
  | 'straight'
  | 'turn_left'
  | 'turn_right'
  | 'arrived';

// ─────────────────────────────────────────────
// HAPTIC PATTERN DEFINITIONS
// ─────────────────────────────────────────────

/**
 * A haptic beat: vibration duration + pause before next beat.
 * amplitude 0.0–1.0 maps to:
 *   - iOS   → CHHapticEvent .intensity parameter
 *   - Android → VibrationEffect amplitude byte (0–255)
 *   - Web   → ignored (Vibration API is binary)
 */
export interface HapticBeat {
  durationMs: number;
  pauseMs: number;
  amplitude: number;
}

/** Fully described haptic pattern for a NavInstruction */
export interface HapticPattern {
  instruction: NavInstruction;
  beats: HapticBeat[];
  totalDurationMs: number;
}

// ─────────────────────────────────────────────
// SPATIAL AUDIO
// ─────────────────────────────────────────────

/** Azimuth in degrees: -90 = hard left, 0 = front, +90 = hard right */
export type AzimuthDeg = number;

export interface SpatialAudioCue {
  instruction: NavInstruction;
  /** null = skip audio (straight when haptic is sufficient) */
  azimuthDeg: AzimuthDeg | null;
  distanceM: number;
  gain: number;
  spatialModel: 'HRTF' | 'equalpower' | 'omni';
}

// ─────────────────────────────────────────────
// GEOFENCE WAYPOINTS
// ─────────────────────────────────────────────

export interface NavWaypoint {
  id: string;
  coord: Coordinates;
  /** Geofence radius in metres */
  triggerRadiusM: number;
  instruction: NavInstruction;
  /** VoiceOver / TalkBack announcement text */
  announcementText: string;
  triggered: boolean;
}

// ─────────────────────────────────────────────
// QUEUE EVENT
// ─────────────────────────────────────────────

export interface NavQueueEvent {
  waypoint: NavWaypoint;
  headphonesConnected: boolean;
  triggeredAt: number;
}

// ─────────────────────────────────────────────
// MODULE STATE
// ─────────────────────────────────────────────

export interface MultiSensoryNavState {
  isActive: boolean;
  headphonesConnected: boolean;
  currentInstruction: NavInstruction | null;
  lastTriggeredWaypointId: string | null;
  remainingWaypoints: number;
  hapticBusy: boolean;
  audioBusy: boolean;
  error: string | null;
}
