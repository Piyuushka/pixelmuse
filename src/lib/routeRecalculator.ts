/**
 * PathFinder Access - Asynchronous Route Recalculation Engine
 *
 * Requirements fulfilled:
 * 1. Asynchronous route recalculation trigger:
 *    - When a barrier state moves to `ACTIVE`, re-run pathfinding for all affected active user sessions.
 *    - Compare the new route ETA and distance with the original route.
 *    - If the new route saves time or avoids a full blockage, emit a reroute payload:
 *      `{ sessionId, newPolyline, timeSaved, hazardType }`
 */

import { Coordinates, calculateHaversineDistance, encodePolyline } from './spatial';
import { closestPointOnSegment } from './h3Indexer';
import { IndianBarrierReport, RoadLayer } from './barrierEngine';
import { IBarrierReport, BarrierStatus, RoadLayerType } from './db/mongoSchema';
import {
  calculateAdaptedRoute,
  compareRoutes,
  DEFAULT_NODES,
  DEFAULT_EDGES,
  RouteResult,
  isBarrierCompleteBlockage,
  isBarrierHeavyFlooding,
  WALKING_SPEED_M_PER_MIN,
} from './routingEngine';
import {
  sessionRegistry,
  NavigationSession,
  NavigationAlert,
} from './navigationSessionRegistry';
import { barrierBroadcaster, ReroutePayload } from './realtimeEngine';

// ============================================================
// ADAPTER: NORMALIZE BARRIER REPORT (Mongo/Postgres <-> Engine)
// ============================================================

export function normalizeToIndianBarrierReport(
  barrier: IndianBarrierReport | IBarrierReport
): IndianBarrierReport {
  // If already an IndianBarrierReport
  if ('title' in barrier && 'category' in barrier && 'votes' in barrier) {
    return barrier as IndianBarrierReport;
  }

  // Convert IBarrierReport (Mongo schema)
  const mongoRep = barrier as IBarrierReport;
  const coords: Coordinates = {
    lat: mongoRep.location.coordinates[1],
    lng: mongoRep.location.coordinates[0],
  };

  const layerMap: Record<RoadLayerType, RoadLayer> = {
    [RoadLayerType.FLYOVER]: 'flyover',
    [RoadLayerType.SERVICE_ROAD]: 'service_road',
    [RoadLayerType.AT_GRADE]: 'at_grade',
  };

  return {
    id: mongoRep._id || `rep-${Date.now()}`,
    title: mongoRep.description || mongoRep.category,
    category: mongoRep.category,
    severity: mongoRep.confidence_score >= 0.7 ? 'critical' : 'high',
    location: mongoRep.location_name || 'Reported Road Location',
    status: mongoRep.status === BarrierStatus.ACTIVE ? 'Verified' : 'Reported',
    votes: mongoRep.upvotes,
    downvotes: mongoRep.downvotes,
    date: 'Just now',
    reportedAt: mongoRep.created_at ? mongoRep.created_at.getTime() : Date.now(),
    reportedBy: 'Community User',
    createdAt: mongoRep.created_at ? mongoRep.created_at.getTime() : Date.now(),
    expiresAt: mongoRep.expires_at ? mongoRep.expires_at.getTime() : Date.now() + 7200 * 1000,
    ttlSeconds: 7200,
    initialTtlSeconds: 7200,
    description: mongoRep.description || '',
    coordinates: coords,
    roadLayer: layerMap[mongoRep.road_layer] || 'at_grade',
    quadKey: '',
    clusterCount: mongoRep.cluster_count || 1,
    isExpired: mongoRep.status === BarrierStatus.EXPIRED,
  };
}

// ============================================================
// ASYNC ROUTE RECALCULATION TRIGGER
// ============================================================

export interface RecalculationOptions {
  activeBarriers?: IndianBarrierReport[];
  proximityBufferMeters?: number;
  autoUpdateSession?: boolean;
}

/**
 * Triggers asynchronous route recalculation when a barrier moves to ACTIVE.
 *
 * Algorithm:
 * 1. Filter all active navigation sessions from `sessionRegistry`.
 * 2. Check if the barrier intersects the session's remaining route (with layer guard).
 * 3. Re-run pathfinding for affected sessions using the updated dynamic edge weight penalties
 *    (Complete Blockage = Infinity, Heavy Flooding = +500% traversal cost).
 * 4. Compare the new route ETA and distance with the original route.
 * 5. If the new route saves time or avoids a full blockage, emit a reroute payload:
 *    `{ sessionId, newPolyline, timeSaved, hazardType }`.
 */
export async function triggerActiveBarrierRecalculation(
  barrierInput: IndianBarrierReport | IBarrierReport,
  options: RecalculationOptions = {}
): Promise<ReroutePayload[]> {
  const barrier = normalizeToIndianBarrierReport(barrierInput);
  const proximityBuffer = options.proximityBufferMeters ?? 120;
  const emittedReroutes: ReroutePayload[] = [];

  // Broadcast that an ACTIVE barrier event was received
  barrierBroadcaster.broadcast({
    type: 'BARRIER_ACTIVATED',
    barrier,
    message: `[Async Router] Barrier "${barrier.title}" entered ACTIVE state. Checking active navigation sessions for rerouting.`,
  });

  const activeSessions = sessionRegistry.getAllActiveSessions();
  if (activeSessions.length === 0) {
    return [];
  }

  // Active barriers pool for Dijkstra
  const allBarriers = options.activeBarriers ? [...options.activeBarriers] : [barrier];
  if (!allBarriers.some(b => b.id === barrier.id)) {
    allBarriers.push(barrier);
  }

  for (const session of activeSessions) {
    // 1. Road layer mismatch guard
    const sessionLayer = session.roadLayer.toLowerCase();
    if (
      (barrier.roadLayer === 'flyover' && sessionLayer !== 'flyover') ||
      (barrier.roadLayer === 'service_road' && sessionLayer === 'flyover')
    ) {
      continue; // Skip parallel lane false positives
    }

    // 2. Proximity & Remaining Route Intersection Check
    const remainingCoords = session.routeCoords.slice(session.currentPositionIndex);
    if (remainingCoords.length < 2) continue;

    let isHazardOnRoute = false;
    for (let i = 0; i < remainingCoords.length - 1; i++) {
      const p1 = remainingCoords[i];
      const p2 = remainingCoords[i + 1];
      const nearest = closestPointOnSegment(barrier.coordinates, p1, p2);
      const dist = calculateHaversineDistance(barrier.coordinates, nearest);
      if (dist <= proximityBuffer) {
        isHazardOnRoute = true;
        break;
      }
    }

    // If the active barrier is not on the user's remaining route, skip
    if (!isHazardOnRoute) continue;

    // 3. Determine start and dest nodes for Dijkstra
    // Snaps user's current GPS position to the closest graph node
    let closestStartNodeId = 'node-start';
    let minStartDist = Infinity;
    for (const [nodeId, node] of Object.entries(DEFAULT_NODES)) {
      const d = calculateHaversineDistance(session.currentGpsCoord, node.coordinates);
      if (d < minStartDist) {
        minStartDist = d;
        closestStartNodeId = nodeId;
      }
    }

    // 4. Compute original baseline route without the new barrier
    const originalBarriers = allBarriers.filter(b => b.id !== barrier.id);
    const originalRoute = calculateAdaptedRoute(
      originalBarriers,
      DEFAULT_NODES,
      DEFAULT_EDGES,
      closestStartNodeId,
      'node-dest'
    );

    // 5. Re-run pathfinding WITH the new ACTIVE barrier penalties applied
    const newRoute = calculateAdaptedRoute(
      allBarriers,
      DEFAULT_NODES,
      DEFAULT_EDGES,
      closestStartNodeId,
      'node-dest'
    );

    // 6. Compare new route ETA and distance with original route
    const comparison = compareRoutes(originalRoute, newRoute, barrier);

    // 7. Check trigger condition:
    // "If the new route saves time or avoids a full blockage, emit a reroute payload: { sessionId, newPolyline, timeSaved, hazardType }"
    if (comparison.shouldReroute) {
      const payload: ReroutePayload = {
        sessionId: session.sessionId,
        newPolyline: newRoute.polyline || encodePolyline(newRoute.coordinates),
        timeSaved: comparison.timeSaved,
        hazardType: comparison.hazardType,
        newDistanceMeters: newRoute.totalDistanceMeters,
        newEtaMinutes: newRoute.estimatedTimeMinutes,
        originalEtaMinutes: comparison.originalEtaMinutes,
        avoidsBlockage: comparison.avoidsFullBlockage,
      };

      emittedReroutes.push(payload);

      // Deliver NavigationAlert to the session
      const alert: NavigationAlert = {
        sessionId: session.sessionId,
        alertId: `reroute-alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'ROUTE_RECALCULATED',
        barrier: {
          id: barrier.id,
          category: barrier.category,
          location: barrier.coordinates,
          distanceAheadMeters: Math.round(
            calculateHaversineDistance(session.currentGpsCoord, barrier.coordinates)
          ),
          estimatedDetourMinutes: comparison.timeSaved,
        },
        message: comparison.avoidsFullBlockage
          ? `⚠️ Complete blockage detected ahead (${comparison.hazardType}). Route automatically recalculated to preserve step-free access.`
          : `⚠️ ${comparison.hazardType} detected ahead. Alternative route avoids delay (estimated ${comparison.timeSaved} min saved).`,
        timestamp: Date.now(),
        urgency: comparison.avoidsFullBlockage ? 'critical' : 'high',
      };

      sessionRegistry.deliverAlert(session.sessionId, alert);

      // Emit event via real-time broadcaster
      barrierBroadcaster.broadcast({
        type: 'REROUTE_EMITTED',
        reroute: payload,
        message: `Reroute emitted for session "${session.sessionId}": avoids ${payload.hazardType}, saves ${payload.timeSaved}m.`,
      });

      // Notify in-browser UI & Voice Assistant listeners
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('pathfinder:route-recalculated', {
              detail: { reroute: payload, alert, newRoute },
            })
          );
        } catch {}
      }

      // Optionally update the session route in registry
      if (options.autoUpdateSession && newRoute.coordinates.length > 0) {
        session.routeCoords = newRoute.coordinates;
        session.totalDistanceMeters = newRoute.totalDistanceMeters;
        session.remainingDistanceMeters = newRoute.totalDistanceMeters;
        session.currentPositionIndex = 0;
      }
    }
  }

  return emittedReroutes;
}
