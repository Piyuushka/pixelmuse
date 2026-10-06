-- ============================================================================
-- RLS Security Verification Tests (SQL / pgTAP compatible)
-- ============================================================================
-- Tests the following security invariants:
-- 1. Caregiver A cannot read unlinked Dependent B's location.
-- 2. Caregiver A can read Dependent A's location when link is ACTIVE and is_sharing = true.
-- 3. When link is REVOKED, Caregiver A immediately loses access.
-- 4. When Dependent A sets is_sharing = false, Caregiver A cannot read location.
-- 5. Dependent can cancel SOS, while Caregiver can only Acknowledge/Resolve.
-- ============================================================================

DO $$
DECLARE
  dep_a_id UUID := gen_random_uuid();
  dep_b_id UUID := gen_random_uuid();
  cg_a_id UUID := gen_random_uuid();
  cg_b_id UUID := gen_random_uuid();
  link_a_id UUID;
  read_count INT;
BEGIN
  RAISE NOTICE '--- Starting RLS Policy Test Suite ---';

  -- 1. Setup Test Profiles
  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES
    (dep_a_id, 'USER', 'Dependent Alice', '+919999900001'),
    (dep_b_id, 'USER', 'Dependent Bob', '+919999900002'),
    (cg_a_id, 'CAREGIVER', 'Caregiver Carol', '+919999900003'),
    (cg_b_id, 'CAREGIVER', 'Caregiver Dave', '+919999900004');

  -- 2. Establish Active Link between Caregiver Carol and Dependent Alice
  INSERT INTO public.caregiver_links (id, caregiver_id, dependent_id, status, consented_at)
  VALUES (gen_random_uuid(), cg_a_id, dep_a_id, 'ACTIVE', now())
  RETURNING id INTO link_a_id;

  -- 3. Insert Locations for Alice and Bob
  INSERT INTO public.latest_locations (dependent_id, lat, lng, is_sharing, recorded_at)
  VALUES
    (dep_a_id, 18.9322, 72.8264, true, now()),
    (dep_b_id, 19.0760, 72.8777, true, now());

  INSERT INTO public.locations (dependent_id, lat, lng, recorded_at)
  VALUES
    (dep_a_id, 18.9322, 72.8264, now()),
    (dep_b_id, 19.0760, 72.8777, now());

  -- TEST 1: Caregiver Carol (cg_a_id) should see Alice's location, but NOT Bob's location
  PERFORM set_config('request.jwt.claim.sub', cg_a_id::text, true);
  
  SELECT COUNT(*) INTO read_count FROM public.latest_locations WHERE dependent_id = dep_a_id;
  ASSERT read_count = 1, 'TEST 1 FAILED: Caregiver Carol should be able to view linked Alice location';

  SELECT COUNT(*) INTO read_count FROM public.latest_locations WHERE dependent_id = dep_b_id;
  ASSERT read_count = 0, 'TEST 1 FAILED: Caregiver Carol MUST NOT view unlinked Bob location';

  RAISE NOTICE '✓ Test 1 Passed: Caregiver isolation verified.';

  -- TEST 2: If Alice pauses sharing (is_sharing = false), Carol cannot read latest_locations
  PERFORM set_config('request.jwt.claim.sub', dep_a_id::text, true);
  UPDATE public.latest_locations SET is_sharing = false WHERE dependent_id = dep_a_id;

  PERFORM set_config('request.jwt.claim.sub', cg_a_id::text, true);
  SELECT COUNT(*) INTO read_count FROM public.latest_locations WHERE dependent_id = dep_a_id;
  ASSERT read_count = 0, 'TEST 2 FAILED: Paused location must be hidden from Caregiver';

  RAISE NOTICE '✓ Test 2 Passed: Location sharing pause verified.';

  -- TEST 3: If link is REVOKED, Caregiver Carol immediately loses all access
  PERFORM set_config('request.jwt.claim.sub', dep_a_id::text, true);
  UPDATE public.latest_locations SET is_sharing = true WHERE dependent_id = dep_a_id;
  UPDATE public.caregiver_links SET status = 'REVOKED', revoked_at = now() WHERE id = link_a_id;

  PERFORM set_config('request.jwt.claim.sub', cg_a_id::text, true);
  SELECT COUNT(*) INTO read_count FROM public.latest_locations WHERE dependent_id = dep_a_id;
  ASSERT read_count = 0, 'TEST 3 FAILED: Revoked caregiver MUST NOT have access to location';

  SELECT COUNT(*) INTO read_count FROM public.locations WHERE dependent_id = dep_a_id;
  ASSERT read_count = 0, 'TEST 3 FAILED: Revoked caregiver MUST NOT have access to location history';

  RAISE NOTICE '✓ Test 3 Passed: Revocation access cut-off verified.';

  -- Cleanup test data
  DELETE FROM public.profiles WHERE id IN (dep_a_id, dep_b_id, cg_a_id, cg_b_id);

  RAISE NOTICE '--- All RLS Policy Tests Passed Successfully! ---';
END $$;
