-- ============================================================================
-- PathFinder Caregiver Safety Module - Complete Base Schema & RLS Policies
-- ============================================================================

-- Enable pgcrypto for UUID generation and hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('USER', 'CAREGIVER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE link_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE consent_action AS ENUM ('REQUESTED', 'APPROVED', 'PAUSED', 'RESUMED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE sos_status AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE geofence_trigger AS ENUM ('ENTER', 'EXIT', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM (
    'SOS',
    'GEOFENCE_ENTER',
    'GEOFENCE_EXIT',
    'CURFEW',
    'LOW_BATTERY',
    'GPS_OFF',
    'INACTIVITY',
    'ROUTE_DEVIATION',
    'CHECKIN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Profiles Table (extends auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'USER',
  full_name TEXT NOT NULL,
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  mobility_profile JSONB DEFAULT '{
    "persona": "wheelchair",
    "requireStepFree": true,
    "maxSlopePercent": 5,
    "needTactilePaving": false,
    "needAudioPrompts": true
  }'::jsonb,
  date_of_birth DATE,
  is_minor BOOLEAN NOT NULL DEFAULT false,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Auto-sync email from auth.users on insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'USER')
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 2. Pairing Codes (Short-lived, stores code_hash)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_dependent ON public.pairing_codes(dependent_id);
CREATE INDEX IF NOT EXISTS idx_pairing_codes_lookup ON public.pairing_codes(code_hash, expires_at) WHERE used_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Caregiver Links (Pairing relationship between caregiver and dependent)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.caregiver_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dependent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status link_status NOT NULL DEFAULT 'PENDING',
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_caregiver_dependent UNIQUE(caregiver_id, dependent_id),
  CONSTRAINT chk_different_users CHECK(caregiver_id <> dependent_id)
);

CREATE INDEX IF NOT EXISTS idx_caregiver_links_status ON public.caregiver_links(caregiver_id, dependent_id, status);

-- ----------------------------------------------------------------------------
-- 4. Consent Logs (Append-only audit trail of consent events)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.caregiver_links(id) ON DELETE CASCADE,
  action consent_action NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_link ON public.consent_logs(link_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Locations (Full historical breadcrumb trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_pct SMALLINT CHECK(battery_pct IS NULL OR (battery_pct >= 0 AND battery_pct <= 100)),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_locations_dependent_time ON public.locations(dependent_id, recorded_at DESC);

-- ----------------------------------------------------------------------------
-- 6. Latest Locations (Single row per dependent, used for realtime map)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.latest_locations (
  dependent_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_pct SMALLINT CHECK(battery_pct IS NULL OR (battery_pct >= 0 AND battery_pct <= 100)),
  is_sharing BOOLEAN NOT NULL DEFAULT true,
  recorded_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 7. Emergency Contacts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relation TEXT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 1,
  notify_sms BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_owner ON public.emergency_contacts(owner_id, priority);

-- ----------------------------------------------------------------------------
-- 8. SOS Events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sos_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status sos_status NOT NULL DEFAULT 'TRIGGERED',
  is_test BOOLEAN NOT NULL DEFAULT true,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION DEFAULT 5.0,
  battery_pct SMALLINT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  note TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sos_events_dependent ON public.sos_events(dependent_id, status, triggered_at DESC);

-- ----------------------------------------------------------------------------
-- 9. Geofences
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dependent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_m DOUBLE PRECISION NOT NULL DEFAULT 200.0,
  active_from TIME,
  active_to TIME,
  notify_on geofence_trigger NOT NULL DEFAULT 'BOTH',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_geofences_dependent ON public.geofences(dependent_id) WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 10. Alerts Log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type alert_type NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_dependent_time ON public.alerts(dependent_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 11. Audit Logs (DPDP Act compliance for location reads)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_dependent_id UUID REFERENCES public.profiles(id),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_dependent_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 12. Push Subscriptions (Web Push / FCM)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  device_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- ----------------------------------------------------------------------------
-- 13. Enable Realtime Replication
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.caregiver_links;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.latest_locations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_events;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 14. Row Level Security (RLS) Helper Functions & Policies
-- ----------------------------------------------------------------------------
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

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Caregivers can view linked dependents profile info" ON public.profiles;
CREATE POLICY "Caregivers can view linked dependents profile info" ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_links
      WHERE caregiver_id = auth.uid()
        AND dependent_id = public.profiles.id
        AND status IN ('ACTIVE', 'PENDING', 'PAUSED')
    )
  );

-- Pairing Codes RLS
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dependents can create and view own pairing codes" ON public.pairing_codes;
CREATE POLICY "Dependents can create and view own pairing codes" ON public.pairing_codes FOR ALL
  USING (dependent_id = auth.uid()) WITH CHECK (dependent_id = auth.uid());

-- Caregiver Links RLS
ALTER TABLE public.caregiver_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Both parties can view their caregiver links" ON public.caregiver_links;
CREATE POLICY "Both parties can view their caregiver links" ON public.caregiver_links FOR SELECT
  USING (caregiver_id = auth.uid() OR dependent_id = auth.uid());

DROP POLICY IF EXISTS "Caregivers can initiate pending link" ON public.caregiver_links;
CREATE POLICY "Caregivers can initiate pending link" ON public.caregiver_links FOR INSERT
  WITH CHECK (caregiver_id = auth.uid() AND status = 'PENDING');

DROP POLICY IF EXISTS "Dependent can activate, pause, or revoke link" ON public.caregiver_links;
CREATE POLICY "Dependent can activate, pause, or revoke link" ON public.caregiver_links FOR UPDATE
  USING (dependent_id = auth.uid() OR caregiver_id = auth.uid())
  WITH CHECK (
    (dependent_id = auth.uid() AND status IN ('ACTIVE', 'PAUSED', 'REVOKED'))
    OR
    (caregiver_id = auth.uid() AND status = 'REVOKED')
  );

-- Locations RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dependents can insert own locations" ON public.locations;
CREATE POLICY "Dependents can insert own locations" ON public.locations FOR INSERT WITH CHECK (dependent_id = auth.uid());

DROP POLICY IF EXISTS "Dependents can read own historical locations" ON public.locations;
CREATE POLICY "Dependents can read own historical locations" ON public.locations FOR SELECT USING (dependent_id = auth.uid());

DROP POLICY IF EXISTS "Active caregivers can read location history if sharing enabled" ON public.locations;
CREATE POLICY "Active caregivers can read location history if sharing enabled" ON public.locations FOR SELECT
  USING (
    public.is_active_caregiver_of(dependent_id)
    AND EXISTS (
      SELECT 1 FROM public.latest_locations
      WHERE dependent_id = public.locations.dependent_id AND is_sharing = true
    )
  );

-- Latest Locations RLS
ALTER TABLE public.latest_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dependents can insert or update own latest location" ON public.latest_locations;
CREATE POLICY "Dependents can insert or update own latest location" ON public.latest_locations FOR ALL
  USING (dependent_id = auth.uid()) WITH CHECK (dependent_id = auth.uid());

DROP POLICY IF EXISTS "Dependents can read own latest location" ON public.latest_locations;
CREATE POLICY "Dependents can read own latest location" ON public.latest_locations FOR SELECT USING (dependent_id = auth.uid());

DROP POLICY IF EXISTS "Active caregivers can read latest location if sharing is true" ON public.latest_locations;
CREATE POLICY "Active caregivers can read latest location if sharing is true" ON public.latest_locations FOR SELECT
  USING (is_sharing = true AND public.is_active_caregiver_of(dependent_id));

-- SOS Events RLS
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dependents can insert own SOS alerts" ON public.sos_events;
CREATE POLICY "Dependents can insert own SOS alerts" ON public.sos_events FOR INSERT WITH CHECK (dependent_id = auth.uid());

DROP POLICY IF EXISTS "Dependents and linked caregivers can view SOS alerts" ON public.sos_events;
CREATE POLICY "Dependents and linked caregivers can view SOS alerts" ON public.sos_events FOR SELECT
  USING (dependent_id = auth.uid() OR public.is_any_caregiver_of(dependent_id));

DROP POLICY IF EXISTS "Caregivers and dependents can update SOS status" ON public.sos_events;
CREATE POLICY "Caregivers and dependents can update SOS status" ON public.sos_events FOR UPDATE
  USING (dependent_id = auth.uid() OR public.is_any_caregiver_of(dependent_id))
  WITH CHECK (
    (dependent_id = auth.uid() AND status = 'CANCELLED')
    OR
    (public.is_any_caregiver_of(dependent_id) AND status IN ('ACKNOWLEDGED', 'RESOLVED'))
  );

-- Geofences RLS
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Caregivers manage own geofences" ON public.geofences;
CREATE POLICY "Caregivers manage own geofences" ON public.geofences FOR ALL
  USING (owner_caregiver_id = auth.uid()) WITH CHECK (owner_caregiver_id = auth.uid());

DROP POLICY IF EXISTS "Dependents can view geofences for transparency" ON public.geofences;
CREATE POLICY "Dependents can view geofences for transparency" ON public.geofences FOR SELECT USING (dependent_id = auth.uid());

-- Emergency Contacts RLS
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Users manage own emergency contacts" ON public.emergency_contacts FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Alerts RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dependents and caregivers view alerts" ON public.alerts;
CREATE POLICY "Dependents and caregivers view alerts" ON public.alerts FOR SELECT
  USING (dependent_id = auth.uid() OR public.is_any_caregiver_of(dependent_id));

DROP POLICY IF EXISTS "Users and caregivers can mark alerts read" ON public.alerts;
CREATE POLICY "Users and caregivers can mark alerts read" ON public.alerts FOR UPDATE
  USING (dependent_id = auth.uid() OR public.is_any_caregiver_of(dependent_id)) WITH CHECK (read_at IS NOT NULL);

-- Consent Logs RLS
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view relevant consent logs" ON public.consent_logs;
CREATE POLICY "Users can view relevant consent logs" ON public.consent_logs FOR SELECT
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.caregiver_links
      WHERE id = public.consent_logs.link_id AND (caregiver_id = auth.uid() OR dependent_id = auth.uid())
    )
  );

-- Push Subscriptions RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
