import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING BARRIER PERSISTENCE VERIFICATION ---');

  // 1. GET /api/barriers
  console.log('\n[TEST 1] GET /api/barriers');
  const getRes = await fetch(`${BASE_URL}/api/barriers`);
  assert.strictEqual(getRes.status, 200, `Expected 200 from GET /api/barriers, got ${getRes.status}`);
  const getData = await getRes.json();
  assert.strictEqual(getData.success, true, 'Expected success: true');
  assert(Array.isArray(getData.barriers), 'Expected barriers array');
  console.log(`✓ Fetched ${getData.barriers.length} barriers successfully`);

  // 2. GET /api/barriers with bbox filter
  console.log('\n[TEST 2] GET /api/barriers with bbox filter');
  // Mumbai Dadar / Bandra area approx: minLng=72.82, minLat=19.00, maxLng=72.86, maxLat=19.10
  const bboxRes = await fetch(`${BASE_URL}/api/barriers?bbox=72.82,19.00,72.86,19.10`);
  assert.strictEqual(bboxRes.status, 200, 'Expected 200 from bbox query');
  const bboxData = await bboxRes.json();
  assert(bboxData.barriers.length >= 2, `Expected at least 2 seeded barriers in Dadar/Bandra bbox, got ${bboxData.barriers.length}`);
  console.log(`✓ Bbox query returned ${bboxData.barriers.length} items`);

  // 3. POST /api/barriers (create new barrier)
  console.log('\n[TEST 3] POST /api/barriers (Create new barrier)');
  const testLat = 19.1200;
  const testLng = 72.8500;
  const createPayload = {
    title: 'Broken Paver Stones & Deep Pothole',
    category: 'broken_footpath',
    severity: 'high',
    lat: testLat,
    lng: testLng,
    location_name: 'Andheri East Station Road',
    micro_location: 'Near Platform 1 Foot-Overbridge',
    description: 'Uneven paving slabs broken by monsoons, impassable for wheelchairs.',
    user_id: 'test-user-alpha',
  };

  const createRes = await fetch(`${BASE_URL}/api/barriers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createPayload),
  });

  assert.strictEqual(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
  const createData = await createRes.json();
  assert.strictEqual(createData.success, true);
  assert.strictEqual(createData.isClustered, false);
  const newBarrierId = createData.barrier.id;
  assert.strictEqual(createData.barrier.title, createPayload.title);
  assert.strictEqual(createData.barrier.status, 'UNVERIFIED');
  assert.strictEqual(createData.barrier.confirmations, 1);
  console.log(`✓ Successfully created barrier ${newBarrierId} (status: UNVERIFIED)`);

  // 4. POST /api/barriers (20-meter clustering duplicate merge)
  console.log('\n[TEST 4] POST /api/barriers within 20m (Spatial Clustering)');
  // 0.00008 degrees lat is approx 8.8 meters
  const clusterPayload = {
    title: 'Paver stones broken nearby',
    category: 'broken_footpath',
    severity: 'high',
    lat: testLat + 0.00008,
    lng: testLng + 0.00008,
    location_name: 'Andheri East Station Road duplicate',
    user_id: 'test-user-beta',
  };

  const clusterRes = await fetch(`${BASE_URL}/api/barriers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clusterPayload),
  });

  assert.strictEqual(clusterRes.status, 201);
  const clusterData = await clusterRes.json();
  assert.strictEqual(clusterData.isClustered, true, 'Expected isClustered to be true');
  assert.strictEqual(clusterData.barrier.id, newBarrierId, 'Expected merged into original barrier ID');
  assert.strictEqual(clusterData.barrier.confirmations, 2, 'Confirmations should increment to 2');
  assert.strictEqual(clusterData.barrier.cluster_count, 2, 'Cluster count should be 2');
  console.log(`✓ 20m spatial cluster successfully detected and merged (confirmations: 2, clusters: 2)`);

  // 5. POST /api/barriers/[id]/vote (One-vote-per-user enforcement)
  console.log('\n[TEST 5] One vote per user enforcement (HTTP 409)');
  // test-user-alpha already created/voted on this barrier
  const dupVoteRes = await fetch(`${BASE_URL}/api/barriers/${newBarrierId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', user_id: 'test-user-alpha' }),
  });
  assert.strictEqual(dupVoteRes.status, 409, `Expected HTTP 409 for duplicate vote, got ${dupVoteRes.status}`);
  const dupVoteData = await dupVoteRes.json();
  assert(dupVoteData.error.includes('already voted'), `Expected error message about already voted, got: ${dupVoteData.error}`);
  console.log(`✓ Duplicate vote rejected with HTTP 409: "${dupVoteData.error}"`);

  // 6. POST /api/barriers/[id]/vote (Transition to COMMUNITY_VERIFIED at 3+ net confirmations)
  console.log('\n[TEST 6] Status State Machine: Promotion to COMMUNITY_VERIFIED at 3+ net confirmations');
  // Currently confirmations: 2, disputes: 0. One more confirm vote should reach 3 net confirmations!
  const thirdVoteRes = await fetch(`${BASE_URL}/api/barriers/${newBarrierId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', user_id: 'test-user-gamma' }),
  });

  assert.strictEqual(thirdVoteRes.status, 200, `Expected 200 OK from vote, got ${thirdVoteRes.status}`);
  const thirdVoteData = await thirdVoteRes.json();
  assert.strictEqual(thirdVoteData.success, true);
  assert.strictEqual(thirdVoteData.barrier.confirmations, 3);
  assert.strictEqual(thirdVoteData.newStatus, 'COMMUNITY_VERIFIED', `Expected status to transition to COMMUNITY_VERIFIED, got ${thirdVoteData.newStatus}`);
  assert.strictEqual(thirdVoteData.statusChanged, true);
  console.log(`✓ Status transitioned to COMMUNITY_VERIFIED with 3 net confirmations!`);

  // 7. Test Timeline history on barrier
  console.log('\n[TEST 7] Report Timeline on Barrier');
  const barrierDetail = thirdVoteData.barrier;
  assert(Array.isArray(barrierDetail.timeline), 'Timeline should be an array');
  assert(barrierDetail.timeline.length >= 3, `Expected at least 3 timeline events, got ${barrierDetail.timeline.length}`);
  const actions = barrierDetail.timeline.map((e: any) => e.action);
  console.log('Timeline actions recorded:', actions);
  assert(actions.includes('REPORTED'), 'Timeline missing REPORTED action');
  assert(actions.includes('CONFIRMED'), 'Timeline missing CONFIRMED action');
  assert(actions.includes('STATUS_CHANGED'), 'Timeline missing STATUS_CHANGED action');
  console.log('✓ Anonymized timeline contains all lifecycle steps');

  // 8. Test Rate Limiting on Voting endpoint
  console.log('\n[TEST 8] Rate Limiting (15 req/min window)');
  let hitRateLimit = false;
  for (let i = 0; i < 20; i++) {
    const rlRes = await fetch(`${BASE_URL}/api/barriers/bar-dadar-ramp/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.195', // Distinct IP for rate limiter test
      },
      body: JSON.stringify({ action: 'confirm', user_id: `rate-limit-tester-${i}` }),
    });
    if (rlRes.status === 429) {
      hitRateLimit = true;
      const rlData = await rlRes.json();
      console.log(`✓ Rate limit triggered on iteration ${i + 1}: ${rlData.error}`);
      break;
    }
  }
  assert.strictEqual(hitRateLimit, true, 'Expected rate limiter to return HTTP 429 after 15 requests');

  // 9. Verify Community Confidence page renders HTTP 200
  console.log('\n[TEST 9] Community Confidence Web Page (HTTP 200)');
  const pageRes = await fetch(`${BASE_URL}/community-confidence`);
  assert.strictEqual(pageRes.status, 200, `Expected 200 from /community-confidence, got ${pageRes.status}`);
  const html = await pageRes.text();
  assert(html.includes('Community Confidence') || html.includes('Report an Accessibility Barrier'), 'Page should contain expected text');
  console.log(`✓ Page /community-confidence rendered successfully (HTTP 200, ${html.length} bytes)`);

  console.log('\n🎉 ALL 9 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
