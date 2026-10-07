/**
 * PathFinder Access - Trust & Continuous Recalibration Unit Test Suite
 *
 * Verifies:
 * 1. Continuous exponential decay with category-specific half-lives (hours vs months).
 * 2. Edge cases: disputed items, zero confirmations, Bayesian consensus.
 * 3. Weakest-link route confidence analysis, stale segment detection (90+ days),
 *    and safer alternative triggers.
 */

import {
  computeTrust,
  routeConfidence,
  calculateContinuousDecay,
  resolveCategoryHalfLife,
  HALF_LIFE_HOURS,
  TrustableItem,
} from '../src/lib/trust';

function runTestSuite() {
  console.log('================================================================');
  console.log(' PATHFINDER TRUST & CONTINUOUS RECALIBRATION ENGINE UNIT TESTS  ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (detail) console.error(`    Detail: ${detail}`);
    }
  }

  const BASE_TIME = 1775500000000; // Fixed mock timestamp

  // =========================================================================
  // SUITE 1: CONTINUOUS TIME DECAY & CATEGORY HALF-LIVES
  // =========================================================================
  console.log('SUITE 1: Continuous Exponential Time Decay & Category Volatility');

  // Test 1.1: Math decay function exponential behavior
  const halfLife = 4; // 4 hours
  const decay0 = calculateContinuousDecay(0, halfLife);
  const decay4 = calculateContinuousDecay(4, halfLife);
  const decay8 = calculateContinuousDecay(8, halfLife);
  const decay12 = calculateContinuousDecay(12, halfLife);

  assert(decay0 === 1.0, 'Decay factor at t=0 is 1.0 (100% fresh)');
  assert(Math.abs(decay4 - 0.5) < 0.001, 'Decay factor at t=t_half is exactly 0.5 (50%)');
  assert(Math.abs(decay8 - 0.25) < 0.001, 'Decay factor at t=2*t_half is exactly 0.25 (25%)');
  assert(Math.abs(decay12 - 0.125) < 0.001, 'Decay factor at t=3*t_half is exactly 0.125 (12.5%)');

  // Test 1.2: Category half-life resolutions
  const floodItem: TrustableItem = { title: 'Waterlogging near Gate 2', category: 'flooding' };
  const rampItem: TrustableItem = { title: 'Wheelchair Ramp North Entrance', category: 'ramp' };
  const elevatorItem: TrustableItem = { title: 'Station Elevator Concourse', category: 'elevator' };
  const crossingItem: TrustableItem = { title: 'Signalized Pedestrian Crossing', category: 'crossing' };

  assert(resolveCategoryHalfLife(floodItem) === 4, 'Flooding category resolves to 4 hours half-life');
  assert(resolveCategoryHalfLife(elevatorItem) === 336, 'Elevator category resolves to 336 hours (14 days) half-life');
  assert(resolveCategoryHalfLife(crossingItem) === 1080, 'Crossing category resolves to 1080 hours (45 days) half-life');
  assert(resolveCategoryHalfLife(rampItem) === 2160, 'Ramp category resolves to 2160 hours (90 days) half-life');

  // Test 1.3: Flooding vs Ramp decay disparity at 24 hours
  const floodAt24h = computeTrust(
    {
      ...floodItem,
      source: 'community',
      lastVerified: new Date(BASE_TIME - 24 * 3600000), // 24 hours ago
      confirmations: 5,
    },
    BASE_TIME
  );

  const rampAt24h = computeTrust(
    {
      ...rampItem,
      source: 'community',
      lastVerified: new Date(BASE_TIME - 24 * 3600000), // 24 hours ago
      confirmations: 5,
    },
    BASE_TIME
  );

  assert(
    floodAt24h.decayFactor < 0.02,
    'Flooding at 24 hours decays to <2% due to rapid weather volatility',
    `decayFactor: ${floodAt24h.decayFactor}`
  );
  assert(
    rampAt24h.decayFactor > 0.99,
    'Ramp at 24 hours maintains >99% freshness due to structural durability',
    `decayFactor: ${rampAt24h.decayFactor}`
  );
  assert(
    floodAt24h.score < rampAt24h.score,
    `Flooding trust score (${floodAt24h.score}) is significantly lower than ramp score (${rampAt24h.score}) after 24 hours`
  );

  // Test 1.4: Ramp at 90 days reaches half-life
  const rampAt90d = computeTrust(
    {
      ...rampItem,
      source: 'official',
      lastVerified: new Date(BASE_TIME - 90 * 86400000), // 90 days ago
      confirmations: 10,
    },
    BASE_TIME
  );
  assert(
    Math.abs(rampAt90d.decayFactor - 0.5) < 0.02,
    'Ramp at 90 days reaches ~0.5 decay factor (90-day half-life)',
    `decayFactor: ${rampAt90d.decayFactor}`
  );

  console.log('\nSUITE 2: Edge Cases (Disputed Items & Zero Confirmations)');

  // Test 2.1: Disputed Item (disputes >= confirmations)
  const disputedItem: TrustableItem = {
    title: 'Supposed Step-Free Entrance',
    category: 'entrance',
    source: 'community',
    lastVerified: new Date(BASE_TIME - 3600000),
    confirmations: 4,
    disputes: 5, // Disputes outnumber confirmations
  };
  const disputedTrust = computeTrust(disputedItem, BASE_TIME);
  const disputeBreakdown = disputedTrust.breakdown.find((b) => b.label.includes('Disputed'));

  assert(
    disputeBreakdown !== undefined && disputeBreakdown.value === -25,
    'Disputed item incurs severe -25 point penalty in breakdown',
    `Breakdown value: ${disputeBreakdown?.value}`
  );
  assert(
    disputedTrust.level === 'low',
    `Disputed item drops to 'low' trust level (Score: ${disputedTrust.score})`
  );

  // Test 2.2: Zero Confirmations (Unconfirmed Community vs Official)
  const unconfirmedCommunity: TrustableItem = {
    title: 'Reported Puddle',
    category: 'flooding',
    source: 'community',
    lastVerified: new Date(BASE_TIME - 1800000), // 30 mins ago
    confirmations: 0,
    disputes: 0,
  };
  const unconfirmedOfficial: TrustableItem = {
    title: 'Station Concourse Door A',
    category: 'entrance',
    source: 'official',
    lastVerified: new Date(BASE_TIME - 1800000),
    confirmations: 0,
    disputes: 0,
  };

  const communityTrust = computeTrust(unconfirmedCommunity, BASE_TIME);
  const officialTrust = computeTrust(unconfirmedOfficial, BASE_TIME);

  assert(
    communityTrust.score < officialTrust.score,
    `Unconfirmed community report (${communityTrust.score} pts) ranks lower than authoritative official data (${officialTrust.score} pts)`
  );
  assert(
    officialTrust.score >= 70,
    `Official record maintains High trust baseline (Score: ${officialTrust.score}) even prior to crowd confirmations`
  );

  // Test 2.3: Boundary Clamping
  const extremeNegativeItem: TrustableItem = {
    title: 'Trolled Fake Ramp',
    category: 'ramp',
    source: 'community',
    lastVerified: new Date(BASE_TIME - 1000 * 86400000), // Ancient
    confirmations: 0,
    disputes: 50,
  };
  const clampedTrust = computeTrust(extremeNegativeItem, BASE_TIME);
  assert(clampedTrust.score >= 0, `Trust score is non-negative (Clamped: ${clampedTrust.score})`);
  assert(clampedTrust.score <= 100, `Trust score does not exceed 100 (Clamped: ${clampedTrust.score})`);

  console.log('\nSUITE 3: Weakest-Link Route Confidence & Safer Alternative Flow');

  // Test 3.1: Pristine Route
  const pristineRoute = [
    { id: 'step-1', title: 'Concourse Ramp', category: 'ramp', source: 'official', confirmations: 20, lastVerified: new Date(BASE_TIME - 3600000) },
    { id: 'step-2', title: 'Tactile Crosswalk', category: 'crossing', source: 'survey', confirmations: 15, lastVerified: new Date(BASE_TIME - 7200000) },
    { id: 'step-3', title: 'Station Elevator', category: 'elevator', source: 'official', confirmations: 30, lastVerified: new Date(BASE_TIME - 3600000) },
  ];
  const pristineConf = routeConfidence(pristineRoute, BASE_TIME);
  assert(pristineConf.overallLevel === 'high', `Pristine route scores High level (${pristineConf.overallScore} pts)`);
  assert(pristineConf.needsSaferAlternative === false, 'Pristine route does not require safer alternative');
  assert(pristineConf.staleSegmentsCount === 0, 'Zero stale segments on pristine route');

  // Test 3.2: Stale Segments (2 segments older than 90 days)
  const staleRoute = [
    { id: 'step-1', title: 'Main Ramp', category: 'ramp', source: 'imported', confirmations: 2, lastVerified: new Date(BASE_TIME - 95 * 86400000) }, // 95 days
    { id: 'step-2', title: 'Urban Sidewalk', category: 'sidewalk', source: 'imported', confirmations: 1, lastVerified: new Date(BASE_TIME - 110 * 86400000) }, // 110 days
    { id: 'step-3', title: 'Controlled Crossing', category: 'crossing', source: 'survey', confirmations: 10, lastVerified: new Date(BASE_TIME - 5 * 86400000) },
  ];
  const staleConf = routeConfidence(staleRoute, BASE_TIME);
  assert(staleConf.staleSegmentsCount === 2, `Correctly identifies 2 stale segments (Found: ${staleConf.staleSegmentsCount})`);
  assert(
    staleConf.summary.includes('Medium: 2 segments not verified in 90+ days'),
    `Summary matches weakest-link format: "${staleConf.summary}"`
  );
  assert(staleConf.needsSaferAlternative === true, 'Flags needsSaferAlternative = true for stale route');
  assert(staleConf.warningMessage !== null, 'Generates explanatory caution warning');

  // Test 3.3: Disputed Segment Weakest-Link
  const hazardousRoute = [
    { id: 'step-1', title: 'Fresh Ramp', category: 'ramp', source: 'official', confirmations: 20, lastVerified: new Date(BASE_TIME - 3600000) },
    { id: 'step-2', title: 'Disputed Broken Lift', category: 'elevator', source: 'community', confirmations: 1, disputes: 8, lastVerified: new Date(BASE_TIME - 3600000) },
  ];
  const hazardousConf = routeConfidence(hazardousRoute, BASE_TIME);
  assert(hazardousConf.overallLevel === 'low', `Route with disputed link drops overallLevel to 'low'`);
  assert(
    hazardousConf.weakestSegment?.segmentId === 'step-2',
    `Identifies step-2 as weakest link (Title: ${hazardousConf.weakestSegment?.title})`
  );
  assert(hazardousConf.needsSaferAlternative === true, 'Requires safer alternative for low confidence route');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} / ${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite();
