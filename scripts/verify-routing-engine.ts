/**
 * Test & Verification Suite for Dynamic Barrier Penalties & Route Recalculation
 */

import {
  calculateAdaptedRoute,
  computeEdgePenalty,
  isBarrierCompleteBlockage,
  isBarrierHeavyFlooding,
  generateGraphHopperCustomModel,
  generateOsrmSpeedConfig,
  compareRoutes,
  DEFAULT_NODES,
  DEFAULT_EDGES,
  COMPLETE_BLOCKAGE_COST,
  HEAVY_FLOODING_COST_MULTIPLIER,
} from '../src/lib/routingEngine';
import { createBarrierReport, IndianBarrierReport } from '../src/lib/barrierEngine';
import { encodePolyline, decodePolyline } from '../src/lib/spatial';
import { sessionRegistry } from '../src/lib/navigationSessionRegistry';
import { triggerActiveBarrierRecalculation } from '../src/lib/routeRecalculator';
import { BarrierCategory, BarrierStatus } from '../src/lib/db/mongoSchema';
import { barrierBroadcaster } from '../src/lib/realtimeEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 1. Testing Polyline Encoding & Decoding');
  console.log('======================================================');

  const testCoords = [
    { lat: 19.0760, lng: 72.8777 },
    { lat: 19.0765, lng: 72.8782 },
    { lat: 19.0770, lng: 72.8788 },
  ];
  const encoded = encodePolyline(testCoords);
  console.log(`Encoded polyline: "${encoded}"`);
  assert(typeof encoded === 'string' && encoded.length > 0, 'Polyline encoded to non-empty string');

  const decoded = decodePolyline(encoded);
  assert(decoded.length === testCoords.length, 'Decoded points length matches');
  assert(Math.abs(decoded[0].lat - testCoords[0].lat) < 0.0001, 'Latitude decoded within precision');
  assert(Math.abs(decoded[0].lng - testCoords[0].lng) < 0.0001, 'Longitude decoded within precision');

  console.log('\n======================================================');
  console.log('🧪 2. Testing Complete Blockage Penalty (Cost = Infinity)');
  console.log('======================================================');

  const blockageBarrier = createBarrierReport({
    title: 'Collapsed Scaffold / Full Road Barricade',
    category: 'Blocked Ramp/Flyover',
    severity: 'critical',
    location: 'Central Concourse Walkway',
    coordinates: { lat: 19.0765, lng: 72.8782 }, // Near edge e-1
  });

  assert(isBarrierCompleteBlockage(blockageBarrier), 'Barrier identified as Complete Blockage');

  // Compute penalty for edge e-1
  const edgeE1 = DEFAULT_EDGES[0];
  const midCoords = {
    lat: (DEFAULT_NODES[edgeE1.source].coordinates.lat + DEFAULT_NODES[edgeE1.target].coordinates.lat) / 2,
    lng: (DEFAULT_NODES[edgeE1.source].coordinates.lng + DEFAULT_NODES[edgeE1.target].coordinates.lng) / 2,
  };

  const penaltyE1 = computeEdgePenalty(edgeE1, midCoords, [blockageBarrier]);
  assert(penaltyE1.cost === COMPLETE_BLOCKAGE_COST, 'Complete blockage edge weight is Infinity');
  assert(penaltyE1.isCompleteBlockage === true, 'Flagged as complete blockage');

  // Route calculation: should avoid edge e-1 and reroute via South Ramp C (e-3 -> e-4 -> e-5)
  const routeWithBlockage = calculateAdaptedRoute([blockageBarrier]);
  console.log('Route with blockage:', routeWithBlockage.pathNodeIds);
  assert(!routeWithBlockage.pathNodeIds.includes('node-elev-b'), 'Route circumvents blocked node-elev-b');
  assert(routeWithBlockage.pathNodeIds.includes('node-ramp-c'), 'Route rerouted via step-free South Ramp C');
  assert(routeWithBlockage.isAdapted === true, 'Route marked as adapted');
  assert(routeWithBlockage.polyline.length > 0, 'Route includes valid polyline');

  console.log('\n======================================================');
  console.log('🧪 3. Testing Heavy Flooding / Waterlogging Penalty (+500% Traversal Cost)');
  console.log('======================================================');

  const floodingBarrier = createBarrierReport({
    title: 'Severe Flash Flooding & Waterlogging',
    category: 'Flooding/Waterlogging',
    severity: 'high',
    location: 'Central Concourse Walkway',
    coordinates: { lat: 19.0765, lng: 72.8782 },
  });

  assert(isBarrierHeavyFlooding(floodingBarrier), 'Barrier identified as Heavy Flooding');

  const floodPenalty = computeEdgePenalty(edgeE1, midCoords, [floodingBarrier]);
  const expectedFloodingCost = (edgeE1.distanceMeters * edgeE1.surfaceFrictionMultiplier) * HEAVY_FLOODING_COST_MULTIPLIER;
  assert(floodPenalty.cost === expectedFloodingCost, `Flooding cost is 6x (+500%): expected ${expectedFloodingCost}, got ${floodPenalty.cost}`);
  assert(floodPenalty.isHeavyFlooding === true, 'Flagged as heavy flooding');

  // Test when alternative exists: Dijkstra should choose the dry detour because 6x on e-1 (250m * 6 = 1500) > detour (180+220+160 = 560m)
  const routeWithFlooding = calculateAdaptedRoute([floodingBarrier]);
  console.log('Route with flooding detour:', routeWithFlooding.pathNodeIds);
  assert(routeWithFlooding.pathNodeIds.includes('node-ramp-c'), 'Detour chosen over flooded edge when alternative exists');

  // Test when NO alternative exists:
  // Create a minimal graph with ONLY a flooded edge
  const singleEdgeGraph = [
    { ...edgeE1, id: 'e-only', source: 'node-start', target: 'node-dest' }
  ];
  const routeNoAlternative = calculateAdaptedRoute([floodingBarrier], DEFAULT_NODES, singleEdgeGraph, 'node-start', 'node-dest');
  assert(routeNoAlternative.pathNodeIds.length === 2, 'Routes through flooded edge when no alternative exists');
  assert(routeNoAlternative.containsHeavyFlooding === true, 'Flags that flooded segment was traversed');

  console.log('\n======================================================');
  console.log('🧪 4. Testing GraphHopper & OSRM Export Configurations');
  console.log('======================================================');

  const ghModel = generateGraphHopperCustomModel([blockageBarrier, floodingBarrier]);
  assert(ghModel.priority.some(p => p.multiply_by === 0.0), 'GraphHopper custom model has 0.0 priority for blockage');
  assert(ghModel.speed.some(s => s.multiply_by === 0.1667), 'GraphHopper custom model has 0.1667 speed factor for flooding');

  const osrmConfig = generateOsrmSpeedConfig([blockageBarrier, floodingBarrier]);
  assert(osrmConfig.blockedOsmWayIds.length > 0, 'OSRM config has blocked OSM ways');
  assert(osrmConfig.speedReductions.some(sr => Math.abs(sr.speedFactor - 1/6) < 0.001), 'OSRM config has 1/6 speed factor for flooding');

  console.log('\n======================================================');
  console.log('🧪 5. Testing Asynchronous Route Recalculation Trigger & Payload Emission');
  console.log('======================================================');

  // Setup an active navigation session in sessionRegistry
  const testSession = sessionRegistry.startSession({
    userId: 'user-pilot-42',
    routeCoords: [
      { lat: 19.0760, lng: 72.8777 }, // node-start
      { lat: 19.0770, lng: 72.8788 }, // node-elev-b
      { lat: 19.0780, lng: 72.8800 }, // node-dest
    ],
    roadLayer: 'at_grade' as any,
    estimatedMinutes: 6,
  });

  console.log(`Created active session: ${testSession.sessionId}`);

  // Capture emitted reroute event
  let receivedRerouteEvent: any = null;
  const unsubscribe = barrierBroadcaster.subscribe(evt => {
    if (evt.type === 'REROUTE_EMITTED') {
      receivedRerouteEvent = evt.reroute;
    }
  });

  // Trigger recalculation when barrier moves to ACTIVE
  const activeBarrier = {
    ...blockageBarrier,
    status: 'Verified' as const, // ACTIVE state
  };

  const reroutePayloads = await triggerActiveBarrierRecalculation(activeBarrier);
  unsubscribe();

  assert(reroutePayloads.length > 0, 'Recalculation triggered and returned emitted reroute payloads');
  const payload = reroutePayloads[0];

  console.log('Emitted Reroute Payload:', payload);
  assert(payload.sessionId === testSession.sessionId, 'Payload sessionId matches active session');
  assert(typeof payload.newPolyline === 'string' && payload.newPolyline.length > 0, 'Payload contains valid newPolyline string');
  assert(payload.hazardType === 'Complete Blockage', 'Payload hazardType is "Complete Blockage"');
  assert(payload.timeSaved >= 1, `Payload timeSaved is positive (saved ${payload.timeSaved}m)`);
  assert(receivedRerouteEvent !== null, 'barrierBroadcaster broadcasted REROUTE_EMITTED event');
  assert(receivedRerouteEvent.sessionId === testSession.sessionId, 'Broadcast event sessionId matches');

  // Clean up
  sessionRegistry.endSession(testSession.sessionId);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! All requirements verified.\n');
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
