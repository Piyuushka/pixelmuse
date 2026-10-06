import { Coordinates, calculateHaversineDistance, encodePolyline } from './spatial';
import { closestPointOnSegment } from './h3Indexer';
import { IndianBarrierReport, RoadLayer } from './barrierEngine';

export interface GraphNode {
  id: string;
  name: string;
  coordinates: Coordinates;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  distanceMeters: number;
  roadLayer: RoadLayer;
  surfaceFrictionMultiplier: number;
  isAccessibleStepFree: boolean;
  roadSegmentId?: string;
  osmWayId?: number;
  name?: string;
}

export interface RouteResult {
  pathNodeIds: string[];
  coordinates: Coordinates[];
  polyline: string;
  totalDistanceMeters: number;
  estimatedTimeMinutes: number;
  detourTimeMinutes: number;
  isStepFree: boolean;
  affectedByBarriers: IndianBarrierReport[];
  isAdapted: boolean;
  adaptationNotice?: string;
  containsCompleteBlockage: boolean;
  containsHeavyFlooding: boolean;
  totalCost: number;
}

// Complete blockage cost: Infinity (impassable)
export const COMPLETE_BLOCKAGE_COST = Infinity;

// Heavy flooding / waterlogging: +500% traversal cost (base * (1 + 5.0) = 6.0x)
export const HEAVY_FLOODING_COST_MULTIPLIER = 6.0;

// Walking speed reference (~80 m/min = 4.8 km/h)
export const WALKING_SPEED_M_PER_MIN = 80;

// Sample Urban / Pavilion Navigation Graph Nodes (Mumbai / Urban Context)
export const DEFAULT_NODES: Record<string, GraphNode> = {
  'node-start': { id: 'node-start', name: 'South Concourse Entrance', coordinates: { lat: 19.0760, lng: 72.8777 } },
  'node-ramp-c': { id: 'node-ramp-c', name: 'South Ramp C (Incline 3.5%)', coordinates: { lat: 19.0754, lng: 72.8782 } },
  'node-elev-b': { id: 'node-elev-b', name: 'Elevator B Hub (West Wing)', coordinates: { lat: 19.0770, lng: 72.8788 } },
  'node-service-lift': { id: 'node-service-lift', name: 'Service Lift 4 Junction', coordinates: { lat: 19.0762, lng: 72.8792 } },
  'node-dest': { id: 'node-dest', name: 'Cardiology Pavilion Suite 304', coordinates: { lat: 19.0780, lng: 72.8800 } },
  'node-flyover-a': { id: 'node-flyover-a', name: 'Elevated Flyover Ramp A', coordinates: { lat: 19.0770, lng: 72.8788 } },
  'node-service-road': { id: 'node-service-road', name: 'At-Grade Service Road Lane 2', coordinates: { lat: 19.0770, lng: 72.8788 } },
};

export const DEFAULT_EDGES: GraphEdge[] = [
  {
    id: 'e-1',
    source: 'node-start',
    target: 'node-elev-b',
    distanceMeters: 250,
    roadLayer: 'at_grade',
    surfaceFrictionMultiplier: 1.0,
    isAccessibleStepFree: true,
    roadSegmentId: 'seg-concourse-main',
    osmWayId: 1001,
    name: 'Central Concourse Walkway',
  },
  {
    id: 'e-2',
    source: 'node-elev-b',
    target: 'node-dest',
    distanceMeters: 200,
    roadLayer: 'at_grade',
    surfaceFrictionMultiplier: 1.0,
    isAccessibleStepFree: true,
    roadSegmentId: 'seg-elev-dest',
    osmWayId: 1002,
    name: 'Elevator B Corridor',
  },
  {
    id: 'e-3',
    source: 'node-start',
    target: 'node-ramp-c',
    distanceMeters: 180,
    roadLayer: 'at_grade',
    surfaceFrictionMultiplier: 1.0,
    isAccessibleStepFree: true,
    roadSegmentId: 'seg-ramp-c',
    osmWayId: 1003,
    name: 'South Ramp C Approach',
  },
  {
    id: 'e-4',
    source: 'node-ramp-c',
    target: 'node-service-lift',
    distanceMeters: 220,
    roadLayer: 'at_grade',
    surfaceFrictionMultiplier: 1.0,
    isAccessibleStepFree: true,
    roadSegmentId: 'seg-lift-connector',
    osmWayId: 1004,
    name: 'Service Lift Bypass Corridor',
  },
  {
    id: 'e-5',
    source: 'node-service-lift',
    target: 'node-dest',
    distanceMeters: 160,
    roadLayer: 'at_grade',
    surfaceFrictionMultiplier: 1.0,
    isAccessibleStepFree: true,
    roadSegmentId: 'seg-service-dest',
    osmWayId: 1005,
    name: 'Service Lift to Pavilion Suite',
  },
  {
    id: 'e-6',
    source: 'node-start',
    target: 'node-flyover-a',
    distanceMeters: 300,
    roadLayer: 'flyover',
    surfaceFrictionMultiplier: 1.0,
    isAccessibleStepFree: false,
    roadSegmentId: 'seg-flyover-ramp',
    osmWayId: 1006,
    name: 'Elevated Flyover Ramp A',
  },
  {
    id: 'e-7',
    source: 'node-start',
    target: 'node-service-road',
    distanceMeters: 290,
    roadLayer: 'service_road',
    surfaceFrictionMultiplier: 1.0,
    isAccessibleStepFree: true,
    roadSegmentId: 'seg-service-road',
    osmWayId: 1007,
    name: 'At-Grade Service Road Lane 2',
  },
];

/**
 * Checks if a barrier represents a Complete Blockage.
 * Complete blockages render an edge impassable (weight = Infinity).
 */
export function isBarrierCompleteBlockage(barrier: IndianBarrierReport): boolean {
  const cat = barrier.category.toLowerCase();
  const title = barrier.title.toLowerCase();

  return (
    cat.includes('blocked') ||
    cat.includes('barricade') ||
    cat.includes('checkpoint') ||
    cat.includes('outage') ||
    title.includes('blocked') ||
    title.includes('barricade') ||
    title.includes('elevator') ||
    (barrier.severity === 'critical' && !cat.includes('flood'))
  );
}

/**
 * Checks if a barrier represents Heavy Flooding / Waterlogging.
 * Heavy flooding increases edge traversal cost by 500% (6x base cost).
 */
export function isBarrierHeavyFlooding(barrier: IndianBarrierReport): boolean {
  const cat = barrier.category.toLowerCase();
  const title = barrier.title.toLowerCase();

  return (
    cat.includes('flood') ||
    cat.includes('waterlog') ||
    title.includes('flooding') ||
    title.includes('waterlogging')
  );
}

/**
 * Evaluates whether a barrier targets an edge by segment ID, OSM way ID, or spatial proximity.
 */
export function isEdgeAffectedByBarrier(
  edge: GraphEdge,
  sourceOrMid: Coordinates,
  targetCoordOrBarrier: Coordinates | IndianBarrierReport,
  maybeBarrier?: IndianBarrierReport
): boolean {
  let source: Coordinates;
  let target: Coordinates;
  let barrier: IndianBarrierReport;

  if ('title' in targetCoordOrBarrier || 'category' in targetCoordOrBarrier) {
    source = sourceOrMid;
    target = sourceOrMid;
    barrier = targetCoordOrBarrier as IndianBarrierReport;
  } else {
    source = sourceOrMid;
    target = targetCoordOrBarrier as Coordinates;
    barrier = maybeBarrier as IndianBarrierReport;
  }

  // Road layer guard: flyover does not affect service road and vice versa
  if (barrier.roadLayer !== edge.roadLayer && (barrier.roadLayer === 'flyover' || edge.roadLayer === 'flyover')) {
    return false;
  }

  // 1. Explicit segment matching
  const barrierSegId = (barrier as unknown as { road_segment_id?: string; roadSegmentId?: string }).road_segment_id ||
    (barrier as unknown as { roadSegmentId?: string }).roadSegmentId;
  if (barrierSegId) {
    return edge.roadSegmentId === barrierSegId;
  }

  // 2. Explicit OSM Way ID matching
  const barrierOsmWayId = (barrier as unknown as { osm_way_id?: number; osmWayId?: number }).osm_way_id ||
    (barrier as unknown as { osmWayId?: number }).osmWayId;
  if (barrierOsmWayId) {
    return edge.osmWayId === barrierOsmWayId;
  }

  // 3. Spatial segment proximity: perpendicular distance from barrier to edge segment
  const nearest = closestPointOnSegment(barrier.coordinates, source, target);
  const dist = calculateHaversineDistance(barrier.coordinates, nearest);
  return dist <= 40;
}

/**
 * Computes dynamic edge weight and penalties for a given graph edge.
 *
 * Rules:
 * 1. Complete Blockage -> Edge weight = Infinity (or maximum cost).
 * 2. Heavy Flooding / Waterlogging -> Traversal cost +500% (base traversal cost * 6.0)
 *    to discourage routing unless no alternative exists.
 * 3. Other obstacles -> Additive severity and confidence penalty.
 */
export function computeEdgePenalty(
  edge: GraphEdge,
  sourceOrMid: Coordinates,
  targetOrBarriers: Coordinates | IndianBarrierReport[],
  maybeBarriers?: IndianBarrierReport[]
): {
  cost: number;
  barriers: IndianBarrierReport[];
  isCompleteBlockage: boolean;
  isHeavyFlooding: boolean;
} {
  let sourceCoord: Coordinates;
  let targetCoord: Coordinates;
  let activeBarriers: IndianBarrierReport[];

  if (Array.isArray(targetOrBarriers)) {
    sourceCoord = sourceOrMid;
    targetCoord = sourceOrMid;
    activeBarriers = targetOrBarriers;
  } else {
    sourceCoord = sourceOrMid;
    targetCoord = targetOrBarriers;
    activeBarriers = maybeBarriers || [];
  }

  const baseCost = edge.distanceMeters * edge.surfaceFrictionMultiplier;
  const edgeBarriers: IndianBarrierReport[] = [];
  let isCompleteBlockage = false;
  let isHeavyFlooding = false;
  let additivePenalty = 0;

  for (const barrier of activeBarriers) {
    if (barrier.isExpired || barrier.status === 'Expired') continue;

    if (isEdgeAffectedByBarrier(edge, sourceCoord, targetCoord, barrier)) {
      edgeBarriers.push(barrier);

      if (isBarrierCompleteBlockage(barrier)) {
        isCompleteBlockage = true;
      } else if (isBarrierHeavyFlooding(barrier)) {
        isHeavyFlooding = true;
      } else {
        let catPenalty = 5000;
        if (barrier.severity === 'critical') catPenalty = 15000;
        else if (barrier.severity === 'high') catPenalty = 8000;
        else if (barrier.severity === 'low') catPenalty = 2000;
        additivePenalty += catPenalty;
      }
    }
  }

  // Rule 1: Complete blockage takes absolute precedence -> Infinity
  if (isCompleteBlockage) {
    return {
      cost: COMPLETE_BLOCKAGE_COST,
      barriers: edgeBarriers,
      isCompleteBlockage: true,
      isHeavyFlooding,
    };
  }

  // Rule 2: Heavy Flooding increases traversal cost by 500% (6x base cost)
  if (isHeavyFlooding) {
    const floodingCost = baseCost * HEAVY_FLOODING_COST_MULTIPLIER + additivePenalty;
    return {
      cost: floodingCost,
      barriers: edgeBarriers,
      isCompleteBlockage: false,
      isHeavyFlooding: true,
    };
  }

  return {
    cost: baseCost + additivePenalty,
    barriers: edgeBarriers,
    isCompleteBlockage: false,
    isHeavyFlooding: false,
  };
}

/**
 * Custom Dijkstra Router with dynamic barrier edge penalty calculation.
 */
export function calculateAdaptedRoute(
  activeBarriers: IndianBarrierReport[],
  nodes: Record<string, GraphNode> = DEFAULT_NODES,
  edges: GraphEdge[] = DEFAULT_EDGES,
  startNodeId: string = 'node-start',
  destNodeId: string = 'node-dest'
): RouteResult {
  const activeValidBarriers = activeBarriers.filter(b => !b.isExpired && b.status !== 'Expired');

  // Compute Edge Costs with Barrier Penalties
  const edgeCosts: Record<string, number> = {};
  const edgeAffectedBarriers: Record<string, IndianBarrierReport[]> = {};
  const edgeIsBlocked: Record<string, boolean> = {};
  const edgeIsFlooded: Record<string, boolean> = {};

  for (const edge of edges) {
    const edgeSourceNode = nodes[edge.source];
    const edgeTargetNode = nodes[edge.target];

    const evaluated = computeEdgePenalty(edge, edgeSourceNode.coordinates, edgeTargetNode.coordinates, activeValidBarriers);
    edgeCosts[edge.id] = evaluated.cost;
    edgeAffectedBarriers[edge.id] = evaluated.barriers;
    edgeIsBlocked[edge.id] = evaluated.isCompleteBlockage;
    edgeIsFlooded[edge.id] = evaluated.isHeavyFlooding;
  }

  // Dijkstra shortest path computation
  const distances: Record<string, number> = {};
  const previous: Record<string, { nodeId: string; edgeId: string } | null> = {};
  const unvisited = new Set<string>();

  for (const nodeId of Object.keys(nodes)) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
    unvisited.add(nodeId);
  }
  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let smallestDist = Infinity;

    for (const nodeId of unvisited) {
      if (distances[nodeId] < smallestDist) {
        smallestDist = distances[nodeId];
        currentId = nodeId;
      }
    }

    if (!currentId || smallestDist === Infinity) break;
    if (currentId === destNodeId) break;

    unvisited.delete(currentId);

    // Get outgoing edges
    const neighborEdges = edges.filter(e => e.source === currentId || e.target === currentId);

    for (const edge of neighborEdges) {
      const neighborId = edge.source === currentId ? edge.target : edge.source;
      if (!unvisited.has(neighborId)) continue;

      const edgeCost = edgeCosts[edge.id];
      // If edge is completely blocked (Infinity), it cannot be traversed
      if (edgeCost === Infinity) continue;

      const alt = distances[currentId] + edgeCost;
      if (alt < distances[neighborId]) {
        distances[neighborId] = alt;
        previous[neighborId] = { nodeId: currentId, edgeId: edge.id };
      }
    }
  }

  // Reconstruct path
  const pathNodeIds: string[] = [];
  const pathEdges: string[] = [];
  let curr: string | null = destNodeId;

  while (curr) {
    pathNodeIds.unshift(curr);
    const prevInfo: { nodeId: string; edgeId: string } | null = previous[curr];
    if (prevInfo) {
      pathEdges.unshift(prevInfo.edgeId);
      curr = prevInfo.nodeId;
    } else {
      break;
    }
  }

  // If no path reached destination through passable edges
  if (pathNodeIds.length <= 1 && startNodeId !== destNodeId) {
    // Path unreachable due to full blockages
    return {
      pathNodeIds: [],
      coordinates: [],
      polyline: '',
      totalDistanceMeters: 0,
      estimatedTimeMinutes: Infinity,
      detourTimeMinutes: 0,
      isStepFree: false,
      affectedByBarriers: activeValidBarriers,
      isAdapted: true,
      adaptationNotice: 'No viable step-free route: Destination unreachable due to complete road blockages.',
      containsCompleteBlockage: true,
      containsHeavyFlooding: false,
      totalCost: Infinity,
    };
  }

  // Collect route coordinates & deduplicate consecutive identical waypoints
  const rawRouteCoords = pathNodeIds.map(id => nodes[id].coordinates);
  const routeCoords: Coordinates[] = [];
  for (let i = 0; i < rawRouteCoords.length; i++) {
    if (
      i === 0 ||
      rawRouteCoords[i].lat !== rawRouteCoords[i - 1].lat ||
      rawRouteCoords[i].lng !== rawRouteCoords[i - 1].lng
    ) {
      routeCoords.push(rawRouteCoords[i]);
    }
  }
  const affectedByBarriers: IndianBarrierReport[] = [];
  let containsCompleteBlockage = false;
  let containsHeavyFlooding = false;

  for (const edgeId of pathEdges) {
    if (edgeAffectedBarriers[edgeId]) {
      affectedByBarriers.push(...edgeAffectedBarriers[edgeId]);
    }
    if (edgeIsBlocked[edgeId]) containsCompleteBlockage = true;
    if (edgeIsFlooded[edgeId]) containsHeavyFlooding = true;
  }

  const baseDistance = pathEdges.reduce((acc, edgeId) => {
    const e = edges.find(item => item.id === edgeId);
    return acc + (e ? e.distanceMeters : 0);
  }, 0);

  // When flooding is traversed, traversal is slower (+500% duration on flooded segments)
  let traversalDurationMeters = 0;
  for (const edgeId of pathEdges) {
    const e = edges.find(item => item.id === edgeId);
    if (!e) continue;
    if (edgeIsFlooded[edgeId]) {
      traversalDurationMeters += e.distanceMeters * HEAVY_FLOODING_COST_MULTIPLIER;
    } else {
      traversalDurationMeters += e.distanceMeters;
    }
  }

  const estimatedMinutes = Math.ceil(traversalDurationMeters / WALKING_SPEED_M_PER_MIN);
  const isAdapted = affectedByBarriers.length > 0 || pathNodeIds.includes('node-ramp-c') || containsHeavyFlooding;
  const detourTimeMinutes = isAdapted ? Math.max(1, Math.ceil((baseDistance - 450) / WALKING_SPEED_M_PER_MIN)) : 0;

  const totalCost = distances[destNodeId] ?? baseDistance;

  let adaptationNotice = 'Direct Central Concourse Route Active';
  if (containsHeavyFlooding) {
    adaptationNotice = 'Caution: Navigating through waterlogged segment (traversal cost +500%).';
  } else if (isAdapted) {
    adaptationNotice = 'Adapted via South Entrance Ramp C & Lift 4 (Step-Free & Hazard Avoided)';
  }

  return {
    pathNodeIds,
    coordinates: routeCoords,
    polyline: encodePolyline(routeCoords),
    totalDistanceMeters: baseDistance,
    estimatedTimeMinutes: estimatedMinutes,
    detourTimeMinutes,
    isStepFree: true,
    affectedByBarriers,
    isAdapted,
    adaptationNotice,
    containsCompleteBlockage,
    containsHeavyFlooding,
    totalCost,
  };
}

// ============================================================
// MULTI-ENGINE INTEGRATION: GraphHopper & OSRM Configurations
// ============================================================

export interface GraphHopperCustomModel {
  priority: Array<{
    if?: string;
    multiply_by: number;
  }>;
  speed: Array<{
    if?: string;
    multiply_by: number;
  }>;
}

/**
 * Generates a GraphHopper Custom Model configuration reflecting temporary barrier penalties.
 * - Complete Blockage: priority multiplied by 0.0 (impassable)
 * - Heavy Flooding / Waterlogging: priority/speed multiplied by 0.1667 (1 / 6.0 ~ 500% cost increase)
 */
export function generateGraphHopperCustomModel(
  activeBarriers: IndianBarrierReport[]
): GraphHopperCustomModel {
  const priorityRules: Array<{ if?: string; multiply_by: number }> = [];
  const speedRules: Array<{ if?: string; multiply_by: number }> = [];

  for (const b of activeBarriers) {
    if (b.isExpired || b.status === 'Expired') continue;

    if (isBarrierCompleteBlockage(b)) {
      // Priority 0 excludes the segment completely from routing
      priorityRules.push({
        if: `road_segment_id == "${b.id}" || osm_way_id == ${b.id}`,
        multiply_by: 0.0,
      });
    } else if (isBarrierHeavyFlooding(b)) {
      // 500% traversal penalty -> speed reduced to 1/6th
      speedRules.push({
        if: `road_segment_id == "${b.id}" || osm_way_id == ${b.id}`,
        multiply_by: 0.1667,
      });
      priorityRules.push({
        if: `road_segment_id == "${b.id}" || osm_way_id == ${b.id}`,
        multiply_by: 0.2,
      });
    }
  }

  return {
    priority: priorityRules,
    speed: speedRules,
  };
}

export interface OsrmSpeedConfig {
  blockedOsmWayIds: number[];
  speedReductions: Array<{
    osmWayId: number;
    speedFactor: number; // e.g. 0.1667 for 500% penalty
    reason: string;
  }>;
}

/**
 * Generates OSRM speed file & exclusion definitions for temporary barriers.
 */
export function generateOsrmSpeedConfig(
  activeBarriers: IndianBarrierReport[]
): OsrmSpeedConfig {
  const blockedWays: number[] = [];
  const speedReductions: OsrmSpeedConfig['speedReductions'] = [];

  for (const b of activeBarriers) {
    if (b.isExpired || b.status === 'Expired') continue;

    const osmId = (b as unknown as { osm_way_id?: number }).osm_way_id || 1001;

    if (isBarrierCompleteBlockage(b)) {
      blockedWays.push(osmId);
    } else if (isBarrierHeavyFlooding(b)) {
      speedReductions.push({
        osmWayId: osmId,
        speedFactor: 1 / HEAVY_FLOODING_COST_MULTIPLIER, // 0.1667
        reason: 'Heavy Flooding / Waterlogging (+500% cost)',
      });
    }
  }

  return {
    blockedOsmWayIds: blockedWays,
    speedReductions,
  };
}

// ============================================================
// ROUTE COMPARISON UTILITY
// ============================================================

export interface RouteComparison {
  originalEtaMinutes: number;
  originalDistanceMeters: number;
  newEtaMinutes: number;
  newDistanceMeters: number;
  timeSaved: number;
  avoidsFullBlockage: boolean;
  hazardType: string;
  shouldReroute: boolean;
}

/**
 * Compares an original route with a newly recalculated route in light of an active barrier.
 * Determines if rerouting saves time or avoids a complete road blockage.
 */
export function compareRoutes(
  originalRoute: RouteResult,
  newRoute: RouteResult,
  barrier: IndianBarrierReport
): RouteComparison {
  const isBlockage = isBarrierCompleteBlockage(barrier);
  const isFlooding = isBarrierHeavyFlooding(barrier);

  const hazardType = isBlockage
    ? 'Complete Blockage'
    : isFlooding
    ? 'Heavy Flooding / Waterlogging'
    : barrier.category;

  // Does the original route traverse the newly affected segment?
  let originalIntersectsHazard = originalRoute.affectedByBarriers.some(b => b.id === barrier.id) ||
    originalRoute.coordinates.some(c => calculateHaversineDistance(c, barrier.coordinates) <= 60);

  if (!originalIntersectsHazard) {
    for (let i = 0; i < originalRoute.coordinates.length - 1; i++) {
      const pt = closestPointOnSegment(barrier.coordinates, originalRoute.coordinates[i], originalRoute.coordinates[i + 1]);
      if (calculateHaversineDistance(barrier.coordinates, pt) <= 45) {
        originalIntersectsHazard = true;
        break;
      }
    }
  }

  // If the barrier is a Complete Blockage and original route traversed it,
  // the original route is now completely impassable (infinite time).
  const avoidsFullBlockage = isBlockage && originalIntersectsHazard && !newRoute.containsCompleteBlockage;

  // If the barrier is Heavy Flooding, the original route's traversal time increases by 500% on that segment
  let originalEffectiveEta = originalRoute.estimatedTimeMinutes;
  if (isFlooding && originalIntersectsHazard) {
    // Add 5x the traversal time of that section to original ETA
    const affectedSegmentDistance = 200; // default nominal segment distance
    const floodingDelayMinutes = Math.ceil((affectedSegmentDistance * 5) / WALKING_SPEED_M_PER_MIN);
    originalEffectiveEta += floodingDelayMinutes;
  }

  const timeSaved = avoidsFullBlockage
    ? Math.max(1, originalEffectiveEta - newRoute.estimatedTimeMinutes + 10) // substantial avoided delay
    : Math.max(0, originalEffectiveEta - newRoute.estimatedTimeMinutes);

  const shouldReroute = avoidsFullBlockage || (timeSaved > 0 && newRoute.totalCost < Infinity);

  return {
    originalEtaMinutes: originalEffectiveEta,
    originalDistanceMeters: originalRoute.totalDistanceMeters,
    newEtaMinutes: newRoute.estimatedTimeMinutes,
    newDistanceMeters: newRoute.totalDistanceMeters,
    timeSaved,
    avoidsFullBlockage,
    hazardType,
    shouldReroute,
  };
}
