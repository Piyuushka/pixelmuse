/**
 * Multi-Sensory Navigation Module — Public API barrel
 * PathFinder Access
 *
 * Import from here instead of deep paths:
 *   import { useMultiSensoryNav, NavQueueManager } from '@/lib/multiSensoryNav';
 */

// Types
export type {
  NavInstruction,
  HapticBeat,
  HapticPattern,
  SpatialAudioCue,
  AzimuthDeg,
  NavWaypoint,
  NavQueueEvent,
  MultiSensoryNavState,
} from './types';

// Haptic engine
export {
  HAPTIC_PATTERNS,
  fireHapticCue,
  cancelHaptic,
  isBatterySafe,
} from './hapticEngine';

// Spatial audio engine
export {
  SPATIAL_AUDIO_CUES,
  SpatialAudioEngine,
  getSpatialAudioEngine,
} from './spatialAudioEngine';

// Navigation queue manager
export {
  NavQueueManager,
  navQueueManager,
} from './navQueueManager';
export type { NavQueueListener } from './navQueueManager';
