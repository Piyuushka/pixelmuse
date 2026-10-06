/**
 * PathFinder Access - Navigation Session Registry
 *
 * Tracks all actively navigating users in an in-memory store (swappable
 * with Redis HASH / PostgreSQL table in production).
 *
 * Each NavigationSession record stores:
 *  - Full route polyline (for precise intersection checks)
 *  - Pre-computed H3 cell index at Res 9 (fast first-pass filter)
 *  - Current position index along the route
 *  - Road layer of the active route
 *  - Callback / channel for pushing real-time alerts to the user
 *
 * Session lifecycle:
 *   startSession()    → on "Accept & Navigate" button press
 *   updatePosition()  → called by GPS tick (e.g. every 5-10 seconds)
 *   endSession()      → on arrival, reroute acceptance, or app close
 */

import { Coordinates } from './spatial';
import { RoadLayerType } from './db/mongoSchema';
import {
  H3CellId,
  polylineToH3Cells,
  latLngToH3Cell,
} from './h3Indexer';

// ============================================================
// SESSION TYPES
// ============================================================

export type AlertCallback = (alert: NavigationAlert) => void;

export interface NavigationAlert {
  sessionId: string;
  alertId: string;
  type: 'BARRIER_AHEAD' | 'ROUTE_RECALCULATED' | 'BARRIER_CLEARED';
  barrier?: {
    id: string;
    category: string;
    location: Coordinates;
    distanceAheadMeters: number;
    estimatedDetourMinutes: number;
  };
  message: string;
  timestamp: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface NavigationSession {
  sessionId: string;
  userId: string;

  // Full planned route geometry
  routeCoords: Coordinates[];

  // H3 cells covering the entire route (Res 9 ~174m)
  routeH3Cells: H3CellId[];

  // H3 cell of DESTINATION (Res 8 ~461m)
  destinationH3Cell: H3CellId;

  // Current user position along the route (0 = start, routeCoords.length-1 = dest)
  currentPositionIndex: number;

  // Actual GPS position (may differ slightly from snapped route point)
  currentGpsCoord: Coordinates;

  // Road layer the user is navigating on
  roadLayer: RoadLayerType;

  // Route metadata
  totalDistanceMeters: number;
  remainingDistanceMeters: number;
  estimatedArrivalAt: Date;

  // Alert delivery channel (in-browser callback or SSE stream ID)
  alertCallback?: AlertCallback;
  sseStreamId?: string;

  // Timestamps
  startedAt: Date;
  lastUpdatedAt: Date;
  isActive: boolean;
}

// ============================================================
// SESSION REGISTRY
// ============================================================

export class NavigationSessionRegistry {
  /**
   * Primary index: sessionId → NavigationSession
   */
  private sessions: Map<string, NavigationSession> = new Map();

  /**
   * Inverted spatial index: H3CellId (Res 9) → Set of sessionIds
   * Enables O(1) lookup: "which sessions traverse this cell?"
   */
  private cellIndex: Map<H3CellId, Set<string>> = new Map();

  /**
   * User index: userId → Set of sessionIds (one user may have multiple
   * pending sessions if they reroute mid-journey).
   */
  private userIndex: Map<string, Set<string>> = new Map();

  // --------------------------------------------------------
  // START SESSION
  // --------------------------------------------------------

  /**
   * Register a new navigation session. Computes H3 cell index from full route.
   */
  startSession(input: {
    userId: string;
    routeCoords: Coordinates[];
    roadLayer?: RoadLayerType;
    estimatedMinutes?: number;
    alertCallback?: AlertCallback;
    sseStreamId?: string;
  }): NavigationSession {
    const sessionId = `nav-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const now = new Date();

    // Compute total route distance
    let totalDist = 0;
    for (let i = 0; i < input.routeCoords.length - 1; i++) {
      const { calculateHaversineDistance } = require('./spatial') as typeof import('./spatial');
      totalDist += calculateHaversineDistance(
        input.routeCoords[i],
        input.routeCoords[i + 1]
      );
    }

    // Index route cells at Res 9 for fine-grained intersection
    const routeH3Cells = polylineToH3Cells(input.routeCoords, 9);

    // Destination cell at Res 8 for broader area alerts
    const destCoord = input.routeCoords[input.routeCoords.length - 1];
    const destinationH3Cell = latLngToH3Cell(destCoord, 8);

    const session: NavigationSession = {
      sessionId,
      userId: input.userId,
      routeCoords: input.routeCoords,
      routeH3Cells,
      destinationH3Cell,
      currentPositionIndex: 0,
      currentGpsCoord: input.routeCoords[0],
      roadLayer: input.roadLayer ?? RoadLayerType.AT_GRADE,
      totalDistanceMeters: totalDist,
      remainingDistanceMeters: totalDist,
      estimatedArrivalAt: new Date(now.getTime() + (input.estimatedMinutes ?? 10) * 60_000),
      alertCallback: input.alertCallback,
      sseStreamId: input.sseStreamId,
      startedAt: now,
      lastUpdatedAt: now,
      isActive: true,
    };

    // Register in primary index
    this.sessions.set(sessionId, session);

    // Build cell → session inverted index
    for (const cell of routeH3Cells) {
      if (!this.cellIndex.has(cell)) {
        this.cellIndex.set(cell, new Set());
      }
      this.cellIndex.get(cell)!.add(sessionId);
    }

    // Build user index
    if (!this.userIndex.has(input.userId)) {
      this.userIndex.set(input.userId, new Set());
    }
    this.userIndex.get(input.userId)!.add(sessionId);

    return session;
  }

  // --------------------------------------------------------
  // UPDATE POSITION
  // --------------------------------------------------------

  /**
   * Update the user's current GPS position.
   * Advances `currentPositionIndex` to the nearest route waypoint ahead.
   */
  updatePosition(sessionId: string, newGpsCoord: Coordinates): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    const { calculateHaversineDistance } = require('./spatial') as typeof import('./spatial');

    // Find closest route waypoint from current position onward
    let closestIdx = session.currentPositionIndex;
    let closestDist = Infinity;

    const searchFrom = Math.max(0, session.currentPositionIndex - 1);
    const searchTo = Math.min(session.routeCoords.length - 1, session.currentPositionIndex + 10);

    for (let i = searchFrom; i <= searchTo; i++) {
      const d = calculateHaversineDistance(newGpsCoord, session.routeCoords[i]);
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }

    // Compute remaining distance from new position
    let remainingDist = 0;
    for (let i = closestIdx; i < session.routeCoords.length - 1; i++) {
      remainingDist += calculateHaversineDistance(
        session.routeCoords[i],
        session.routeCoords[i + 1]
      );
    }

    session.currentPositionIndex = closestIdx;
    session.currentGpsCoord = newGpsCoord;
    session.remainingDistanceMeters = remainingDist;
    session.lastUpdatedAt = new Date();

    this.sessions.set(sessionId, session);
  }

  // --------------------------------------------------------
  // END SESSION
  // --------------------------------------------------------

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;

    // Remove from cell inverted index
    for (const cell of session.routeH3Cells) {
      const set = this.cellIndex.get(cell);
      if (set) {
        set.delete(sessionId);
        if (set.size === 0) this.cellIndex.delete(cell);
      }
    }

    // Remove from user index
    const userSet = this.userIndex.get(session.userId);
    if (userSet) {
      userSet.delete(sessionId);
      if (userSet.size === 0) this.userIndex.delete(session.userId);
    }

    this.sessions.delete(sessionId);
  }

  // --------------------------------------------------------
  // LOOKUP METHODS
  // --------------------------------------------------------

  getSession(sessionId: string): NavigationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionsForUser(userId: string): NavigationSession[] {
    const ids = this.userIndex.get(userId) ?? new Set();
    return Array.from(ids)
      .map(id => this.sessions.get(id))
      .filter((s): s is NavigationSession => !!s && s.isActive);
  }

  getSessionsInCell(cellId: H3CellId): NavigationSession[] {
    const ids = this.cellIndex.get(cellId) ?? new Set();
    return Array.from(ids)
      .map(id => this.sessions.get(id))
      .filter((s): s is NavigationSession => !!s && s.isActive);
  }

  getAllActiveSessions(): NavigationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  get activeSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Deliver a NavigationAlert to a specific session via its registered callback.
   */
  deliverAlert(sessionId: string, alert: NavigationAlert): void {
    const session = this.sessions.get(sessionId);
    if (!session?.alertCallback) return;
    session.alertCallback(alert);
  }
}

// Global singleton registry (client-side simulation)
export const sessionRegistry = new NavigationSessionRegistry();
