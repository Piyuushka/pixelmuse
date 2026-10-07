-- ============================================================
-- PathFinder Access - Temporary Barrier System Migration
-- Compatible with Supabase PostgreSQL + PostGIS
-- ============================================================

-- Enable PostGIS spatial extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create Barrier Category & Status Enums
DO $$ BEGIN
  CREATE TYPE barrier_category AS ENUM (
    'stairs',
    'broken_footpath',
    'steep_road',
    'blocked_ramp',
    'inaccessible_entrance',
    'poor_lighting',
    'temporary_obstacle',
    'elevator_outage'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE barrier_status AS ENUM (
    'UNVERIFIED',
    'COMMUNITY_VERIFIED',
    'RESOLVED',
    'DISPUTED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Barrier Reports Table
CREATE TABLE IF NOT EXISTS barrier_reports (
  id                          TEXT PRIMARY KEY,
  user_id                     TEXT NOT NULL,
  title                       TEXT NOT NULL,
  category                    barrier_category NOT NULL,
  status                      barrier_status NOT NULL DEFAULT 'UNVERIFIED',
  location_name               TEXT NOT NULL,
  lat                         FLOAT NOT NULL,
  lng                         FLOAT NOT NULL,
  micro_location              TEXT,
  description                 TEXT,
  photo_url                   TEXT,
  severity                    TEXT NOT NULL DEFAULT 'high',
  estimated_resolution_time  TEXT DEFAULT 'Est. 2h 0m',
  confirmations               INTEGER NOT NULL DEFAULT 1,
  disputes                    INTEGER NOT NULL DEFAULT 0,
  fixed_reports               INTEGER NOT NULL DEFAULT 0,
  cluster_count               INTEGER NOT NULL DEFAULT 1,
  confidence_score            FLOAT NOT NULL DEFAULT 0.5,
  routing_penalty             FLOAT NOT NULL DEFAULT 5000.0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at                  TIMESTAMPTZ NOT NULL,
  resolved_at                 TIMESTAMPTZ,
  timeline                    JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 3. PostGIS Geometry Column (Generated or synced from lat/lng)
DO $$ BEGIN
  ALTER TABLE barrier_reports
    ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED;
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- Spatial GIST Index for Proximity and Bounding-Box Searches
CREATE INDEX IF NOT EXISTS idx_barrier_reports_location
  ON barrier_reports USING GIST (location);

-- Index on Status and Expires_at for TTL Cleaner
CREATE INDEX IF NOT EXISTS idx_barrier_reports_status_expires
  ON barrier_reports (status, expires_at);

-- Index on Category
CREATE INDEX IF NOT EXISTS idx_barrier_reports_category
  ON barrier_reports (category);

-- 4. Barrier Votes Table (Enforces 1 vote per user per barrier report)
CREATE TABLE IF NOT EXISTS barrier_votes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barrier_id  TEXT NOT NULL REFERENCES barrier_reports(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('confirm', 'dispute', 'fixed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_barrier_user_vote UNIQUE (barrier_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_barrier_votes_barrier
  ON barrier_votes (barrier_id);

-- 5. Row-Level Security (RLS) policies for Supabase
ALTER TABLE barrier_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE barrier_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to barrier_reports"
  ON barrier_reports FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated or anon insert to barrier_reports"
  ON barrier_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access to barrier_votes"
  ON barrier_votes FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated or anon insert to barrier_votes"
  ON barrier_votes FOR INSERT
  WITH CHECK (true);
