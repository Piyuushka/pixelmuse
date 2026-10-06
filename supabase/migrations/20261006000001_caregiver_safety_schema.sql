-- ============================================================================
-- Migration 01: PathFinder Caregiver Safety Module - Base Schema
-- ============================================================================

-- Enable pgcrypto for UUID generation and hashing if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum Types
CREATE TYPE user_role AS ENUM ('USER', 'CAREGIVER');
CREATE TYPE link_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REVOKED');
CREATE TYPE consent_action AS ENUM ('REQUESTED', 'APPROVED', 'PAUSED', 'RESUMED', 'REVOKED');
CREATE TYPE sos_status AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
CREATE TYPE geofence_trigger AS ENUM ('ENTER', 'EXIT', 'BOTH');
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

-- ----------------------------------------------------------------------------
-- 1. Profiles Table (extends auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
  is_minor BOOLEAN GENERATED ALWAYS AS (
    date_of_birth IS NOT NULL AND date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
  ) STORED,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for phone/role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

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

-- Critical query index for paginated trail playback
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
