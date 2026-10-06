-- ============================================================
-- PathFinder Access - Temporary Barrier System
-- PostgreSQL + PostGIS Schema
-- ============================================================

-- Enable PostGIS spatial extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For fuzzy text search on location names

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE barrier_category AS ENUM (
  'FLOODING',
  'CONSTRUCTION',
  'BLOCKED_RAMP',
  'BARRICADE',
  'OTHER'
);

CREATE TYPE barrier_status AS ENUM (
  'PENDING',
  'ACTIVE',
  'EXPIRED',
  'DISMISSED'
);

CREATE TYPE road_layer_type AS ENUM (
  'FLYOVER',
  'SERVICE_ROAD',
  'AT_GRADE'
);

-- ============================================================
-- TTL CONSTANTS TABLE (Indian Road Scenario defaults in minutes)
-- ============================================================

CREATE TABLE barrier_category_ttl (
  category        barrier_category PRIMARY KEY,
  ttl_minutes     INTEGER NOT NULL,
  description     TEXT
);

INSERT INTO barrier_category_ttl (category, ttl_minutes, description) VALUES
  ('FLOODING',      180, 'Waterlogging / Monsoon flooding. Avg clearing time 3 hours.'),
  ('BARRICADE',      60, 'Temporary police blockade / road barricade. Avg duration 1 hour.'),
  ('CONSTRUCTION',  720, 'Heavy road construction / infrastructure work. Avg 12 hours.'),
  ('BLOCKED_RAMP',  120, 'Blocked ramp or flyover access. Avg clearing 2 hours.'),
  ('OTHER',         240, 'Miscellaneous obstruction. Default 4 hours.');

-- ============================================================
-- MAIN BARRIER REPORTS TABLE
-- ============================================================

CREATE TABLE barrier_reports (
  -- Identity
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID            NOT NULL,

  -- Classification
  category            barrier_category NOT NULL,
  status              barrier_status   NOT NULL DEFAULT 'PENDING',

  -- Spatial Location (WGS84 / EPSG:4326 Point)
  -- coordinates stored as GEOMETRY(Point, 4326): (longitude, latitude)
  location            GEOMETRY(Point, 4326) NOT NULL,
  location_name       TEXT,

  -- Road segment references
  road_segment_id     VARCHAR(128),
  osm_way_id          BIGINT,
  road_layer          road_layer_type  NOT NULL DEFAULT 'AT_GRADE',

  -- Community scoring
  upvotes             INTEGER          NOT NULL DEFAULT 1,
  downvotes           INTEGER          NOT NULL DEFAULT 0,
  cluster_count       INTEGER          NOT NULL DEFAULT 1,

  -- Confidence: ranges 0.0 to 1.0
  -- Derived: (upvotes - downvotes * 1.5) / (upvotes + downvotes + 1) clamped to [0, 1]
  confidence_score    FLOAT            NOT NULL DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),

  -- Edge penalty applied to routing graph (0 = no penalty, up to 15000 for critical)
  routing_penalty     FLOAT            NOT NULL DEFAULT 5000.0,

  -- Temporal bounds
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ      NOT NULL,
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,

  -- Metadata
  description         TEXT,
  photo_url           TEXT,
  is_clustered        BOOLEAN          NOT NULL DEFAULT FALSE,
  parent_report_id    UUID             REFERENCES barrier_reports(id) ON DELETE SET NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Spatial GIST index for proximity/bounding-box queries
CREATE INDEX idx_barrier_location
  ON barrier_reports USING GIST (location);

-- Status + expires_at composite for TTL cleaner worker
CREATE INDEX idx_barrier_status_expires
  ON barrier_reports (status, expires_at);

-- OSM Way ID for routing graph edge matching
CREATE INDEX idx_barrier_osm_way
  ON barrier_reports (osm_way_id)
  WHERE osm_way_id IS NOT NULL;

-- Road segment for edge weight lookups
CREATE INDEX idx_barrier_road_segment
  ON barrier_reports (road_segment_id)
  WHERE road_segment_id IS NOT NULL;

-- Category-based analytics
CREATE INDEX idx_barrier_category
  ON barrier_reports (category, status);

-- Confidence score for sorting/ranking
CREATE INDEX idx_barrier_confidence
  ON barrier_reports (confidence_score DESC);

-- ============================================================
-- TTL HELPER FUNCTION: compute expires_at from category
-- ============================================================

CREATE OR REPLACE FUNCTION compute_expires_at(cat barrier_category)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  ttl_min INTEGER;
BEGIN
  SELECT ttl_minutes INTO ttl_min
  FROM barrier_category_ttl
  WHERE category = cat;

  RETURN NOW() + (ttl_min * INTERVAL '1 minute');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- CONFIDENCE SCORE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION compute_confidence_score(ups INTEGER, downs INTEGER)
RETURNS FLOAT AS $$
DECLARE
  score FLOAT;
BEGIN
  IF ups + downs = 0 THEN
    RETURN 1.0;
  END IF;
  score := (ups::FLOAT - (downs::FLOAT * 1.5)) / (ups + downs + 1)::FLOAT;
  RETURN GREATEST(0.0, LEAST(1.0, (score + 1.0) / 2.0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- TRIGGER: Auto-set expires_at and confidence_score on INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION barrier_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-compute expires_at if not provided
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := compute_expires_at(NEW.category);
  END IF;

  -- Set initial confidence score
  NEW.confidence_score := compute_confidence_score(NEW.upvotes, NEW.downvotes);

  -- Set initial routing penalty based on status and confidence
  NEW.routing_penalty := CASE NEW.category
    WHEN 'FLOODING'     THEN 8000.0
    WHEN 'CONSTRUCTION' THEN 5000.0
    WHEN 'BLOCKED_RAMP' THEN 12000.0
    WHEN 'BARRICADE'    THEN 10000.0
    ELSE                     4000.0
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_barrier_before_insert
  BEFORE INSERT ON barrier_reports
  FOR EACH ROW EXECUTE FUNCTION barrier_before_insert();

-- ============================================================
-- TRIGGER: Auto-recompute confidence_score + routing_penalty on UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION barrier_before_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.confidence_score := compute_confidence_score(NEW.upvotes, NEW.downvotes);

  -- Reduce routing penalty proportional to lower confidence
  NEW.routing_penalty := NEW.routing_penalty * NEW.confidence_score;

  -- Auto-expire if downvotes heavily outweigh upvotes
  IF NEW.downvotes >= (NEW.upvotes + 3) THEN
    NEW.status := 'EXPIRED';
    NEW.routing_penalty := 0.0;
    NEW.resolved_at := NOW();
  END IF;

  -- Auto-activate from PENDING if confidence reaches threshold
  IF NEW.status = 'PENDING' AND NEW.confidence_score >= 0.5 THEN
    NEW.status := 'ACTIVE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_barrier_before_update
  BEFORE UPDATE ON barrier_reports
  FOR EACH ROW EXECUTE FUNCTION barrier_before_update();

-- ============================================================
-- TTL CLEANER STORED PROCEDURE
-- Expire all active barriers whose expires_at has passed
-- Called by cron job or pg_cron: every 2 minutes
-- ============================================================

CREATE OR REPLACE FUNCTION run_ttl_cleaner()
RETURNS TABLE (expired_id UUID, expired_osm_way_id BIGINT, expired_road_segment_id VARCHAR)
AS $$
BEGIN
  RETURN QUERY
    UPDATE barrier_reports
    SET
      status       = 'EXPIRED',
      routing_penalty = 0.0,
      resolved_at  = NOW(),
      updated_at   = NOW()
    WHERE
      status IN ('PENDING', 'ACTIVE')
      AND expires_at <= NOW()
    RETURNING id, osm_way_id, road_segment_id;
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron (if available):
-- SELECT cron.schedule('ttl-cleaner', '*/2 * * * *', 'SELECT run_ttl_cleaner()');

-- ============================================================
-- SPATIAL PROXIMITY QUERY HELPER
-- Find active barriers within N meters of a given point
-- ============================================================

CREATE OR REPLACE FUNCTION find_barriers_near(
  lng       FLOAT,
  lat       FLOAT,
  radius_m  FLOAT DEFAULT 200
)
RETURNS SETOF barrier_reports AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM barrier_reports
    WHERE
      status IN ('PENDING', 'ACTIVE')
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        radius_m
      )
    ORDER BY
      ST_Distance(
        location::geography,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
      ) ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- ROUTING EDGE PENALTY VIEW
-- Used by the routing engine to join edge weights in real-time
-- ============================================================

CREATE OR REPLACE VIEW active_edge_penalties AS
  SELECT
    osm_way_id,
    road_segment_id,
    road_layer,
    category,
    SUM(routing_penalty) AS total_penalty,
    AVG(confidence_score) AS avg_confidence,
    COUNT(*) AS barrier_count
  FROM barrier_reports
  WHERE
    status = 'ACTIVE'
    AND expires_at > NOW()
    AND osm_way_id IS NOT NULL
  GROUP BY
    osm_way_id, road_segment_id, road_layer, category;
