-- ============================================================================
-- Migration 02: Row Level Security (RLS) Policies
-- ============================================================================

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.is_active_caregiver_of(dep_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.caregiver_links
    WHERE caregiver_id = auth.uid()
      AND dependent_id = dep_id
      AND status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_any_caregiver_of(dep_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.caregiver_links
    WHERE caregiver_id = auth.uid()
      AND dependent_id = dep_id
      AND status IN ('ACTIVE', 'PAUSED')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 1. Profiles RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Caregivers can view linked dependents profile info"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_links
      WHERE caregiver_id = auth.uid()
        AND dependent_id = public.profiles.id
        AND status IN ('ACTIVE', 'PENDING', 'PAUSED')
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Pairing Codes RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dependents can create and view own pairing codes"
  ON public.pairing_codes FOR ALL
  USING (dependent_id = auth.uid())
  WITH CHECK (dependent_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Caregiver Links RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.caregiver_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Both parties can view their caregiver links"
  ON public.caregiver_links FOR SELECT
  USING (caregiver_id = auth.uid() OR dependent_id = auth.uid());

CREATE POLICY "Caregivers can initiate pending link"
  ON public.caregiver_links FOR INSERT
  WITH CHECK (caregiver_id = auth.uid() AND status = 'PENDING');

CREATE POLICY "Dependent can activate, pause, or revoke link"
  ON public.caregiver_links FOR UPDATE
  USING (dependent_id = auth.uid() OR caregiver_id = auth.uid())
  WITH CHECK (
    -- Dependent can approve to ACTIVE, or PAUSE, or REVOKE
    (dependent_id = auth.uid() AND status IN ('ACTIVE', 'PAUSED', 'REVOKED'))
    OR
    -- Caregiver can only revoke their link
    (caregiver_id = auth.uid() AND status = 'REVOKED')
  );

-- ----------------------------------------------------------------------------
-- 4. Locations & Latest Locations RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latest_locations ENABLE ROW LEVEL SECURITY;

-- Locations Table
CREATE POLICY "Dependents can insert own locations"
  ON public.locations FOR INSERT
  WITH CHECK (dependent_id = auth.uid());

CREATE POLICY "Dependents can read own historical locations"
  ON public.locations FOR SELECT
  USING (dependent_id = auth.uid());

CREATE POLICY "Active caregivers can read location history if sharing enabled"
  ON public.locations FOR SELECT
  USING (
    public.is_active_caregiver_of(dependent_id)
    AND EXISTS (
      SELECT 1 FROM public.latest_locations
      WHERE dependent_id = public.locations.dependent_id
        AND is_sharing = true
    )
  );

-- Latest Locations Table
CREATE POLICY "Dependents can insert or update own latest location"
  ON public.latest_locations FOR ALL
  USING (dependent_id = auth.uid())
  WITH CHECK (dependent_id = auth.uid());

CREATE POLICY "Dependents can read own latest location"
  ON public.latest_locations FOR SELECT
  USING (dependent_id = auth.uid());

CREATE POLICY "Active caregivers can read latest location if sharing is true"
  ON public.latest_locations FOR SELECT
  USING (
    is_sharing = true AND public.is_active_caregiver_of(dependent_id)
  );

-- ----------------------------------------------------------------------------
-- 5. SOS Events RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dependents can insert own SOS alerts"
  ON public.sos_events FOR INSERT
  WITH CHECK (dependent_id = auth.uid());

CREATE POLICY "Dependents and linked caregivers can view SOS alerts"
  ON public.sos_events FOR SELECT
  USING (
    dependent_id = auth.uid()
    OR public.is_any_caregiver_of(dependent_id)
  );

CREATE POLICY "Caregivers and dependents can update SOS status"
  ON public.sos_events FOR UPDATE
  USING (
    dependent_id = auth.uid()
    OR public.is_any_caregiver_of(dependent_id)
  )
  WITH CHECK (
    -- Dependent can cancel
    (dependent_id = auth.uid() AND status = 'CANCELLED')
    OR
    -- Caregiver can acknowledge or resolve
    (public.is_any_caregiver_of(dependent_id) AND status IN ('ACKNOWLEDGED', 'RESOLVED'))
  );

-- ----------------------------------------------------------------------------
-- 6. Geofences RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregivers manage own geofences"
  ON public.geofences FOR ALL
  USING (owner_caregiver_id = auth.uid())
  WITH CHECK (owner_caregiver_id = auth.uid());

CREATE POLICY "Dependents can view geofences for transparency"
  ON public.geofences FOR SELECT
  USING (dependent_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. Emergency Contacts RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own emergency contacts"
  ON public.emergency_contacts FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 8. Alerts RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dependents and caregivers view alerts"
  ON public.alerts FOR SELECT
  USING (
    dependent_id = auth.uid()
    OR public.is_any_caregiver_of(dependent_id)
  );

CREATE POLICY "Users and caregivers can mark alerts read"
  ON public.alerts FOR UPDATE
  USING (
    dependent_id = auth.uid()
    OR public.is_any_caregiver_of(dependent_id)
  )
  WITH CHECK (read_at IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 9. Consent Logs & Audit Logs RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relevant consent logs"
  ON public.consent_logs FOR SELECT
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.caregiver_links
      WHERE id = public.consent_logs.link_id
        AND (caregiver_id = auth.uid() OR dependent_id = auth.uid())
    )
  );

CREATE POLICY "Users can view audit logs targeting or enacted by them"
  ON public.audit_logs FOR SELECT
  USING (
    actor_id = auth.uid()
    OR target_dependent_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- 10. Push Subscriptions RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
