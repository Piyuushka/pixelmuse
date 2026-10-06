'use client';

/**
 * useMultiSensoryNav — React Hook
 * PathFinder Access
 *
 * Orchestrates the full Multi-Sensory Navigation experience:
 *
 *   1. Haptic Engine  → fires vibration patterns per NavInstruction
 *   2. Spatial Audio  → fires 3D-positioned ping sounds
 *   3. VoiceOver/TalkBack → accessibility announcement via speechSynthesis
 *   4. Geofence queue → monitors GPS position, triggers cues at waypoints
 *   5. Headphone detection → switches audio model automatically
 *   6. Battery guard  → suppresses haptics at low battery
 *   7. Background guard → resumes AudioContext on page re-focus
 *
 * Usage:
 *   const { state, startNavigation, stopNavigation } = useMultiSensoryNav();
 *
 *   startNavigation(waypointsArray);   // begin session
 *   stopNavigation();                  // end session / cleanup
 *
 * The hook is self-contained: mount it once in your navigation page component.
 * It handles its own teardown on unmount.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useGeolocation } from '@/hooks/useGeolocation';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';

import { fireHapticCue, cancelHaptic, isBatterySafe } from '@/lib/multiSensoryNav/hapticEngine';
import { getSpatialAudioEngine } from '@/lib/multiSensoryNav/spatialAudioEngine';
import { navQueueManager, NavQueueListener } from '@/lib/multiSensoryNav/navQueueManager';
import type {
  NavWaypoint,
  NavQueueEvent,
  MultiSensoryNavState,
} from '@/lib/multiSensoryNav/types';

// ─────────────────────────────────────────────
// DEFAULT STATE
// ─────────────────────────────────────────────

const INITIAL_STATE: MultiSensoryNavState = {
  isActive: false,
  headphonesConnected: false,
  currentInstruction: null,
  lastTriggeredWaypointId: null,
  remainingWaypoints: 0,
  hapticBusy: false,
  audioBusy: false,
  error: null,
};

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useMultiSensoryNav() {
  const [state, setState] = useState<MultiSensoryNavState>(INITIAL_STATE);

  const { coordinates } = useGeolocation();
  const { speakText } = useVoiceFeedback();

  const audioEngineRef = useRef(getSpatialAudioEngine());
  const audioInitialisedRef = useRef(false);
  const removeListenerRef = useRef<(() => void) | null>(null);

  // ─────────────────────────────────────────────
  // HEADPHONE DETECTION
  // ─────────────────────────────────────────────

  useEffect(() => {
    const detectHeadphones = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudioOutput = devices.some(
          d => d.kind === 'audiooutput' && d.deviceId !== 'default'
        );
        setState(prev => ({ ...prev, headphonesConnected: hasAudioOutput }));
        navQueueManager.setHeadphonesConnected(hasAudioOutput);
      } catch {
        // enumerateDevices may require permission — default to not connected
      }
    };

    detectHeadphones();

    // Re-detect on device change (plug/unplug)
    const handler = () => detectHeadphones();
    navigator.mediaDevices?.addEventListener('devicechange', handler);

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handler);
    };
  }, []);

  // ─────────────────────────────────────────────
  // GPS TICK → GEOFENCE CHECK
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!coordinates || !state.isActive) return;
    navQueueManager.onPositionUpdate(coordinates);
  }, [coordinates, state.isActive]);

  // ─────────────────────────────────────────────
  // PAGE VISIBILITY → AUDIO CONTEXT RESUME
  // ─────────────────────────────────────────────

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        audioEngineRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ─────────────────────────────────────────────
  // QUEUE EVENT HANDLER
  // ─────────────────────────────────────────────

  const handleQueueEvent: NavQueueListener = useCallback(
    async (event: NavQueueEvent) => {
      const { waypoint, headphonesConnected } = event;
      const { instruction, announcementText } = waypoint;

      setState(prev => ({
        ...prev,
        currentInstruction: instruction,
        lastTriggeredWaypointId: waypoint.id,
        remainingWaypoints: navQueueManager.remainingCount,
        hapticBusy: true,
        audioBusy: headphonesConnected || instruction !== 'straight',
      }));

      // ── 1. VoiceOver / TalkBack announcement ──────────────────────────────
      // Fires first so screen-reader users get immediate context even before
      // haptic / audio (which may have up to ~100 ms hardware latency).
      speakText(announcementText);

      // ── 2. Haptic + Spatial Audio (simultaneous) ──────────────────────────
      const safe = await isBatterySafe();

      await Promise.all([
        // Haptic
        safe
          ? fireHapticCue(instruction)
          : Promise.resolve(false),

        // Spatial Audio
        (headphonesConnected || audioEngineRef.current.hasStereoOutput)
          ? audioEngineRef.current.playCue(instruction, headphonesConnected)
          : (instruction === 'arrived'
              // Always play arrived sound even on mono speakers
              ? audioEngineRef.current.playCue(instruction, false)
              : Promise.resolve()
            ),
      ]);

      // ── 3. Mark cue complete ──────────────────────────────────────────────
      navQueueManager.markCueComplete();

      setState(prev => ({
        ...prev,
        hapticBusy: false,
        audioBusy: false,
        isActive: !navQueueManager.allTriggered,
      }));
    },
    [speakText]
  );

  // ─────────────────────────────────────────────
  // PUBLIC: startNavigation
  // ─────────────────────────────────────────────

  /**
   * Begin a navigation session.
   *
   * IMPORTANT: This must be called inside a user-gesture handler (e.g. button
   * press) because the SpatialAudioEngine initialises an AudioContext here.
   * Browsers block AudioContext creation outside of user interaction.
   */
  const startNavigation = useCallback(async (waypoints: NavWaypoint[]) => {
    if (waypoints.length === 0) {
      setState(prev => ({ ...prev, error: 'No waypoints provided.' }));
      return;
    }

    // Initialise AudioContext inside user gesture
    if (!audioInitialisedRef.current) {
      try {
        await audioEngineRef.current.init();
        audioInitialisedRef.current = true;
      } catch (err) {
        // Non-fatal — audio will be silently skipped
        console.warn('[MultiSensoryNav] AudioContext init failed:', err);
      }
    }

    navQueueManager.start(waypoints);

    // Register event listener
    if (removeListenerRef.current) {
      removeListenerRef.current();
    }
    removeListenerRef.current = navQueueManager.addListener(handleQueueEvent);

    setState({
      ...INITIAL_STATE,
      isActive: true,
      remainingWaypoints: navQueueManager.remainingCount,
      headphonesConnected: state.headphonesConnected,
    });
  }, [handleQueueEvent, state.headphonesConnected]);

  // ─────────────────────────────────────────────
  // PUBLIC: stopNavigation
  // ─────────────────────────────────────────────

  const stopNavigation = useCallback(() => {
    cancelHaptic();
    navQueueManager.stop();
    removeListenerRef.current?.();
    removeListenerRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // ─────────────────────────────────────────────
  // CLEANUP ON UNMOUNT
  // ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelHaptic();
      navQueueManager.stop();
      removeListenerRef.current?.();
      audioEngineRef.current.destroy().catch(() => {});
      audioInitialisedRef.current = false;
    };
  }, []);

  // ─────────────────────────────────────────────
  // MANUAL CUE (for testing / demo)
  // ─────────────────────────────────────────────

  /**
   * Manually fire a cue without GPS — useful for:
   *  • Demo / preview screens
   *  • Unit tests
   *  • Guardian mode triggered alerts
   */
  const fireCueManually = useCallback(async (
    waypoint: NavWaypoint
  ) => {
    await handleQueueEvent({
      waypoint,
      headphonesConnected: state.headphonesConnected,
      triggeredAt: Date.now(),
    });
  }, [handleQueueEvent, state.headphonesConnected]);

  return {
    state,
    startNavigation,
    stopNavigation,
    fireCueManually,
    /** Expose queue manager for advanced use (e.g. re-routing) */
    queueManager: navQueueManager,
  };
}
