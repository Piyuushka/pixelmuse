/**
 * Multi-Sensory Navigation Module — Navigation Queue Manager
 * PathFinder Access
 *
 * Owns the ordered list of NavWaypoints, watches live GPS position,
 * evaluates geofence entry for each waypoint, and dispatches
 * NavQueueEvents to registered listeners.
 *
 * Design notes:
 *  - Singleton class — one instance per navigation session.
 *  - Events are processed sequentially; while a cue fires, new GPS
 *    ticks accumulate but no second cue fires (debounce guard).
 *  - Geofence radius is configurable per-waypoint (default 15 m).
 *  - Consecutive duplicate-instruction debouncing prevents double-firing
 *    when GPS jitter keeps the user on the geofence boundary.
 */

import { calculateHaversineDistance, Coordinates } from '@/lib/spatial';
import type { NavWaypoint, NavQueueEvent, NavInstruction } from './types';

// ─────────────────────────────────────────────
// EVENT LISTENER TYPE
// ─────────────────────────────────────────────

export type NavQueueListener = (event: NavQueueEvent) => void;

// ─────────────────────────────────────────────
// QUEUE MANAGER
// ─────────────────────────────────────────────

export class NavQueueManager {
  private waypoints: NavWaypoint[] = [];
  private listeners: Set<NavQueueListener> = new Set();

  /** True while a cue is being processed (haptic + audio) */
  private isFiring = false;

  /** Debounce: ms since last cue before we allow another */
  private readonly DEBOUNCE_MS = 2_000;
  private lastFiredAt = 0;

  /** Last triggered instruction to prevent consecutive duplicates */
  private lastInstruction: NavInstruction | null = null;

  /** Whether stereo headphones are connected */
  private headphonesConnected = false;

  // ─────────────────────────────────────────────
  // SESSION LIFECYCLE
  // ─────────────────────────────────────────────

  /**
   * Start a new navigation session with an ordered waypoint list.
   * Calling start() while a session is active replaces the waypoint queue.
   */
  start(waypoints: NavWaypoint[]): void {
    this.waypoints = waypoints.map(wp => ({ ...wp, triggered: false }));
    this.isFiring = false;
    this.lastFiredAt = 0;
    this.lastInstruction = null;
  }

  /** Clear all waypoints and reset state. */
  stop(): void {
    this.waypoints = [];
    this.isFiring = false;
    this.lastInstruction = null;
  }

  /** Update headphone state from the hook layer. */
  setHeadphonesConnected(connected: boolean): void {
    this.headphonesConnected = connected;
  }

  // ─────────────────────────────────────────────
  // GPS POSITION UPDATE  (called on every GPS tick)
  // ─────────────────────────────────────────────

  /**
   * Evaluate the current GPS position against all un-triggered waypoints.
   * Should be called from useGeolocation's watch callback.
   *
   * Performance: O(n) where n = remaining waypoints.
   * Typical route has ≤ 50 waypoints so this is negligible on-device.
   */
  onPositionUpdate(coord: Coordinates): void {
    if (this.waypoints.length === 0) return;

    const now = Date.now();
    const debounceOk = (now - this.lastFiredAt) > this.DEBOUNCE_MS;

    if (!debounceOk || this.isFiring) return;

    for (const wp of this.waypoints) {
      if (wp.triggered) continue;

      const dist = calculateHaversineDistance(coord, wp.coord);
      if (dist <= wp.triggerRadiusM) {
        this.triggerWaypoint(wp, now);
        break; // Process one at a time
      }
    }
  }

  // ─────────────────────────────────────────────
  // TRIGGER
  // ─────────────────────────────────────────────

  private triggerWaypoint(wp: NavWaypoint, now: number): void {
    wp.triggered = true;
    this.lastFiredAt = now;
    this.isFiring = true;
    this.lastInstruction = wp.instruction;

    const event: NavQueueEvent = {
      waypoint: wp,
      headphonesConnected: this.headphonesConnected,
      triggeredAt: now,
    };

    // Notify all registered listeners (hook, component, etc.)
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[NavQueue] Listener threw:', err);
      }
    }
  }

  /**
   * Mark current cue as finished so the queue can process the next trigger.
   * Call this from the hook after haptic + audio have both completed.
   */
  markCueComplete(): void {
    this.isFiring = false;
  }

  // ─────────────────────────────────────────────
  // LISTENER MANAGEMENT
  // ─────────────────────────────────────────────

  addListener(listener: NavQueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  removeListener(listener: NavQueueListener): void {
    this.listeners.delete(listener);
  }

  // ─────────────────────────────────────────────
  // INTROSPECTION
  // ─────────────────────────────────────────────

  get remainingCount(): number {
    return this.waypoints.filter(wp => !wp.triggered).length;
  }

  get allTriggered(): boolean {
    return this.waypoints.every(wp => wp.triggered);
  }

  get pendingWaypoints(): NavWaypoint[] {
    return this.waypoints.filter(wp => !wp.triggered);
  }

  // ─────────────────────────────────────────────
  // WAYPOINT FACTORY  (static helpers)
  // ─────────────────────────────────────────────

  /**
   * Create a NavWaypoint from raw coordinates + instruction.
   * Default trigger radius of 15 m is appropriate for urban pedestrian GPS.
   * Increase to 25–30 m for lower-accuracy devices.
   */
  static createWaypoint(
    id: string,
    coord: Coordinates,
    instruction: NavInstruction,
    announcementText: string,
    triggerRadiusM = 15
  ): NavWaypoint {
    return {
      id,
      coord,
      triggerRadiusM,
      instruction,
      announcementText,
      triggered: false,
    };
  }

  /**
   * Build a complete ordered waypoint queue from a GeoJSON-style
   * coordinate array (e.g. from ORS route geometry) + turn instruction array.
   *
   * The first point is always 'straight', last is always 'arrived'.
   */
  static buildFromRoute(
    coords: Coordinates[],
    instructions: NavInstruction[]
  ): NavWaypoint[] {
    if (coords.length === 0) return [];

    return coords.map((coord, i) => {
      const instruction: NavInstruction =
        i === coords.length - 1 ? 'arrived' :
        (instructions[i] ?? 'straight');

      const text =
        instruction === 'turn_left'  ? 'Turn left ahead' :
        instruction === 'turn_right' ? 'Turn right ahead' :
        instruction === 'arrived'    ? 'You have arrived at your destination' :
        'Continue straight';

      return NavQueueManager.createWaypoint(
        `wp-${i}`,
        coord,
        instruction,
        text,
        i === coords.length - 1 ? 20 : 15  // wider radius for destination
      );
    });
  }
}

// ─────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────

export const navQueueManager = new NavQueueManager();
