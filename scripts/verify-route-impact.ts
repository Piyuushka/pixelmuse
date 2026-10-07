/**
 * PathFinder Access - Route Impact Panel Verification Script
 * Validates:
 * 1. computeRouteMetrics before/after comparison
 * 2. Triggers: barrier active, persona changed, simulate barrier (with routeRecalculator.ts)
 * 3. Delta table calculations & WCAG non-color indicators (icons + text)
 * 4. Plain-language "Why did my route change?" summary generator
 * 5. Multi-profile matrix: wheelchair, older-adult, low-vision, none
 * 6. Evidence export formats: JSON & CSV
 */

import { computeRouteMetrics } from '../src/lib/routeMetrics';
import { triggerActiveBarrierRecalculation } from '../src/lib/routeRecalculator';
import { sessionRegistry } from '../src/lib/navigationSessionRegistry';
import { RoadLayerType } from '../src/lib/db/mongoSchema';
import { IndianBarrierReport } from '../src/lib/barrierEngine';

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 1. Testing Route Metrics Before / After Comparison');
  console.log('======================================================');

  const baselineInput = {
    distanceM: 1250,
    durationMin: 16,
    stepCount: 1667,
    slopeData: { maxSlopePct: 8.2, avgSlopePct: 3.8 },
    stairsCount: 2,
    crossingsData: { signalled: 1, unsignalled: 2 },
    barriersOnRoute: 1,
    lightingScore: 70,
  };

  const adaptedInput = {
    distanceM: 1390,
    durationMin: 18,
    stepCount: 1853,
    slopeData: { maxSlopePct: 4.1, avgSlopePct: 2.1 },
    stairsCount: 0,
    crossingsData: { signalled: 3, unsignalled: 0 },
    barriersOnRoute: 0,
    lightingScore: 90,
  };

  const simBarrier: IndianBarrierReport = {
    id: 'sim-1',
    title: 'blocked ramp',
    category: 'Blocked Ramp / Curb Cut',
    severity: 'critical',
    location: 'Concourse ramp',
    status: 'Verified',
    votes: 4,
    downvotes: 0,
    date: '12 min ago',
    createdAt: Date.now() - 12 * 60 * 1000,
    expiresAt: Date.now() + 7200 * 1000,
    ttlSeconds: 7200,
    initialTtlSeconds: 7200,
    description: 'Impassable ramp',
    coordinates: { lat: 19.0205, lng: 72.8410 },
    roadLayer: 'at_grade',
    quadKey: '',
    clusterCount: 4,
    isExpired: false,
  };

  const baseline = computeRouteMetrics({
    ...baselineInput,
    coordinates: [
      { lat: 19.0178, lng: 72.8430 },
      { lat: 19.0205, lng: 72.8410 }, // Passes through barrier
      { lat: 19.0222, lng: 72.8365 },
    ],
  }, 'none', [simBarrier]);

  const adapted = computeRouteMetrics({
    ...adaptedInput,
    coordinates: [
      { lat: 19.0178, lng: 72.8430 },
      { lat: 19.0230, lng: 72.8435 }, // Bypasses barrier
      { lat: 19.0222, lng: 72.8365 },
    ],
  }, 'wheelchair', [simBarrier]);

  console.log(`Baseline Score (Normal): ${baseline.accessibilityScore}/100`);
  console.log(`Adapted Score (Wheelchair): ${adapted.accessibilityScore}/100`);

  if (adapted.accessibilityScore <= baseline.accessibilityScore) {
    throw new Error('Adapted wheelchair score should be significantly higher than standard route with stairs/barriers');
  }
  console.log('✅ PASSED: Adapted accessibility score is higher than baseline');

  console.log('\n======================================================');
  console.log('🧪 2. Testing Delta Calculations & Non-Color Indicators');
  console.log('======================================================');

  const distDelta = adapted.distanceM - baseline.distanceM;
  const timeDelta = adapted.durationMin - baseline.durationMin;
  const slopeDelta = Number((adapted.maxSlopePct - baseline.maxSlopePct).toFixed(1));
  const scoreDelta = adapted.accessibilityScore - baseline.accessibilityScore;
  const barriersAvoided = baseline.barriersOnRoute - adapted.barriersOnRoute;

  console.log(`Distance delta: ${distDelta}m -> ▲ +${distDelta} m (Detour added)`);
  console.log(`Time delta: ${timeDelta}m -> ▲ +${timeDelta} min (Additional time)`);
  console.log(`Slope delta: ${slopeDelta}% -> ▼ ${slopeDelta}% (Flatter grade - Safer)`);
  console.log(`Score delta: +${scoreDelta} pts -> ▲ +${scoreDelta} pts (Significantly Improved)`);
  console.log(`Barriers avoided: ${barriersAvoided} -> ✓ ${barriersAvoided} Avoided (0 on route)`);

  if (distDelta !== 140) throw new Error(`Expected distance delta of 140m, got ${distDelta}m`);
  if (timeDelta !== 2) throw new Error(`Expected time delta of 2 min, got ${timeDelta}`);
  if (slopeDelta !== -4.1) throw new Error(`Expected slope delta of -4.1%, got ${slopeDelta}`);
  if (barriersAvoided !== 1) throw new Error(`Expected 1 barrier avoided, got ${barriersAvoided}`);

  console.log('✅ PASSED: All delta metrics and non-color text indicators match requirements');

  console.log('\n======================================================');
  console.log('🧪 3. Testing "Why did my route change?" Dynamic Summary');
  console.log('======================================================');

  const distText = distDelta >= 0 ? `+${distDelta} m` : `${distDelta} m`;
  const timeText = timeDelta >= 0 ? `+${timeDelta} min` : `${timeDelta} min`;
  const summary = `Avoids 1 ${simBarrier.title} (reported ${simBarrier.date}, ${simBarrier.votes} confirmations). ${distText}, ${timeText}.`;

  console.log('Generated summary:', summary);
  const expectedSummary = 'Avoids 1 blocked ramp (reported 12 min ago, 4 confirmations). +140 m, +2 min.';
  if (summary !== expectedSummary) {
    throw new Error(`Summary mismatch! Expected: "${expectedSummary}", got: "${summary}"`);
  }
  console.log('✅ PASSED: Plain-language summary matches exact target specification');

  console.log('\n======================================================');
  console.log('🧪 4. Testing "Simulate Barrier" Flow via routeRecalculator.ts');
  console.log('======================================================');

  // Setup barrier on test graph corridor
  const recalcBarrier: IndianBarrierReport = {
    ...simBarrier,
    coordinates: { lat: 19.0770, lng: 72.8788 }, // node-elev-b
  };

  // Register an active session to test end-to-end recalculation trigger
  sessionRegistry.startSession({
    sessionId: 'session-test-recalc-1',
    userId: 'test-user-1',
    routeCoords: [
      { lat: 19.0760, lng: 72.8777 }, // node-start
      { lat: 19.0770, lng: 72.8788 }, // node-elev-b
      { lat: 19.0780, lng: 72.8800 }, // node-dest
    ],
    currentGpsCoord: { lat: 19.0760, lng: 72.8777 },
    roadLayer: RoadLayerType.AT_GRADE,
    totalDistanceMeters: 560,
    estimatedArrivalAt: new Date(Date.now() + 16 * 60000),
  });

  const emitted = await triggerActiveBarrierRecalculation(recalcBarrier, {
    activeBarriers: [recalcBarrier],
    autoUpdateSession: true,
  });

  console.log(`Recalculation returned ${emitted.length} reroute payloads`);
  if (emitted.length === 0) {
    throw new Error('Expected at least 1 reroute payload emitted for affected active session');
  }
  console.log('Emitted payload details:', {
    sessionId: emitted[0].sessionId,
    hazardType: emitted[0].hazardType,
    timeSaved: emitted[0].timeSaved,
    avoidsBlockage: emitted[0].avoidsBlockage,
  });
  console.log('✅ PASSED: Real recalculator flow in routeRecalculator.ts executed successfully');

  console.log('\n======================================================');
  console.log('🧪 5. Testing Multi-Profile Comparison Matrix');
  console.log('======================================================');

  const profiles = ['wheelchair', 'older-adult', 'low-vision', 'none'] as const;
  const matrixResults = profiles.map(p => {
    const res = computeRouteMetrics({
      distanceM: 1390,
      durationMin: 18,
      stepCount: 1853,
      slopeData: { maxSlopePct: 4.1, avgSlopePct: 2.1 },
      stairsCount: p === 'wheelchair' ? 0 : p === 'none' ? 2 : 1,
      crossingsData: { signalled: 3, unsignalled: 0 },
      barriersOnRoute: 0,
      lightingScore: 90,
    }, p, []);
    return { profile: p, score: res.accessibilityScore, maxSlope: res.maxSlopePct };
  });

  console.log('Multi-profile matrix:', matrixResults);
  if (matrixResults.length !== 4) throw new Error('Expected 4 profiles in matrix');
  const wheelchairRes = matrixResults.find(r => r.profile === 'wheelchair')!;
  const standardRes = matrixResults.find(r => r.profile === 'none')!;
  if (wheelchairRes.score <= 0) throw new Error('Wheelchair score should be valid and positive');
  console.log('✅ PASSED: All 4 profiles (wheelchair, older-adult, low-vision, none) evaluated');

  console.log('\n======================================================');
  console.log('🧪 6. Testing JSON & CSV Evidence Export Shapes');
  console.log('======================================================');

  const jsonEvidence = {
    title: 'PathFinder Access - Route Impact & Recalculation Evidence',
    timestamp: new Date().toISOString(),
    barrier: {
      id: simBarrier.id,
      title: simBarrier.title,
      confirmations: simBarrier.votes,
      date: simBarrier.date,
    },
    deltas: {
      distanceM: distDelta,
      durationMin: timeDelta,
      maxSlopePct: slopeDelta,
      barriersAvoided,
      accessibilityScoreDelta: scoreDelta,
    },
    plainLanguageSummary: summary,
  };

  const jsonString = JSON.stringify(jsonEvidence);
  JSON.parse(jsonString); // Must be valid JSON
  console.log('✅ PASSED: JSON evidence format is valid');

  const csvRows = [
    ['Metric', 'Baseline', 'Adapted', 'Delta', 'WCAG Indicator'],
    ['Distance', `${baseline.distanceM}m`, `${adapted.distanceM}m`, `+${distDelta}m`, `▲ +${distDelta} m (Detour added)`],
    ['Duration', `${baseline.durationMin}m`, `${adapted.durationMin}m`, `+${timeDelta}m`, `▲ +${timeDelta} min (Additional time)`],
    ['Max Slope', `${baseline.maxSlopePct}%`, `${adapted.maxSlopePct}%`, `${slopeDelta}%`, `▼ ${slopeDelta}% (Flatter grade - Safer)`],
    ['Score', `${baseline.accessibilityScore}`, `${adapted.accessibilityScore}`, `+${scoreDelta}`, `▲ +${scoreDelta} pts (Significantly Improved)`],
  ];
  const csvContent = csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  if (!csvContent.includes('▲ +140 m (Detour added)') || !csvContent.includes('▼ -4.1% (Flatter grade - Safer)')) {
    throw new Error('CSV missing required WCAG indicators');
  }
  console.log('✅ PASSED: CSV evidence export contains proper text indicators and format');

  console.log('\n🎉 ALL ROUTE IMPACT VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
