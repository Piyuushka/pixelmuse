/**
 * PathFinder Access - Temporary Barrier System
 * MongoDB Mongoose Schema Definitions
 *
 * Provides a drop-in alternative to the PostgreSQL schema for
 * projects using MongoDB Atlas. GeoJSON 2dsphere spatial indexing
 * enables $geoNear / $geoWithin queries for proximity and bounding
 * box collision detection used by the routing engine.
 */

// NOTE: In production import from 'mongoose'. This file uses type-safe
// interfaces so it can be imported as pure TypeScript with no Mongoose
// runtime required during frontend build (used only on a backend service).

// ============================================================
// ENUMS
// ============================================================

export enum BarrierCategory {
  FLOODING     = 'FLOODING',
  CONSTRUCTION = 'CONSTRUCTION',
  BLOCKED_RAMP = 'BLOCKED_RAMP',
  BARRICADE    = 'BARRICADE',
  OTHER        = 'OTHER',
}

export enum BarrierStatus {
  PENDING   = 'PENDING',
  ACTIVE    = 'ACTIVE',
  EXPIRED   = 'EXPIRED',
  DISMISSED = 'DISMISSED',
}

export enum RoadLayerType {
  FLYOVER      = 'FLYOVER',
  SERVICE_ROAD = 'SERVICE_ROAD',
  AT_GRADE     = 'AT_GRADE',
}

// ============================================================
// CATEGORY TTL MAP (minutes) - Indian road context
// ============================================================

export const CATEGORY_TTL_MINUTES: Record<BarrierCategory, number> = {
  [BarrierCategory.FLOODING]:     180,  // Waterlogging: 3 hours
  [BarrierCategory.BARRICADE]:     60,  // Police blockade: 1 hour
  [BarrierCategory.CONSTRUCTION]: 720,  // Heavy roadwork: 12 hours
  [BarrierCategory.BLOCKED_RAMP]: 120,  // Blocked ramp: 2 hours
  [BarrierCategory.OTHER]:        240,  // Misc: 4 hours
};

// ============================================================
// BASE ROUTING PENALTY MAP (edge cost units, severity-based)
// ============================================================

export const CATEGORY_BASE_PENALTY: Record<BarrierCategory, number> = {
  [BarrierCategory.FLOODING]:      8000,
  [BarrierCategory.CONSTRUCTION]:  5000,
  [BarrierCategory.BLOCKED_RAMP]: 12000,
  [BarrierCategory.BARRICADE]:    10000,
  [BarrierCategory.OTHER]:         4000,
};

// ============================================================
// TYPESCRIPT INTERFACE (mirrors MongoDB document shape)
// ============================================================

export interface IBarrierReport {
  _id?: string;
  user_id: string;

  // Classification
  category: BarrierCategory;
  status: BarrierStatus;

  // GeoJSON Point (MongoDB 2dsphere compatible)
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  location_name?: string;

  // Road segment identifiers
  road_segment_id?: string;
  osm_way_id?: number;
  road_layer: RoadLayerType;

  // Community scoring
  upvotes: number;
  downvotes: number;
  cluster_count: number;

  // Derived score: ranges [0.0, 1.0]
  confidence_score: number;

  // Routing edge penalty applied to graph
  routing_penalty: number;

  // Temporal
  created_at: Date;
  expires_at: Date;
  updated_at: Date;
  resolved_at?: Date;

  // Metadata
  description?: string;
  photo_url?: string;
  is_clustered: boolean;
  parent_report_id?: string;
}

// ============================================================
// MONGOOSE SCHEMA DEFINITION (for use in Node.js/Next.js backend)
// ============================================================

export const BarrierReportSchemaDefinition = {
  user_id: { type: String, required: true, index: true },

  category: {
    type: String,
    enum: Object.values(BarrierCategory),
    required: true,
  },

  status: {
    type: String,
    enum: Object.values(BarrierStatus),
    default: BarrierStatus.PENDING,
    index: true,
  },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  location_name: { type: String },

  road_segment_id: { type: String, index: true, sparse: true },
  osm_way_id:      { type: Number, index: true, sparse: true },
  road_layer: {
    type: String,
    enum: Object.values(RoadLayerType),
    default: RoadLayerType.AT_GRADE,
  },

  upvotes:       { type: Number, default: 1, min: 0 },
  downvotes:     { type: Number, default: 0, min: 0 },
  cluster_count: { type: Number, default: 1, min: 1 },

  confidence_score: { type: Number, default: 1.0, min: 0.0, max: 1.0 },
  routing_penalty:  { type: Number, default: 5000.0, min: 0.0 },

  expires_at:   { type: Date, required: true, index: true },
  updated_at:   { type: Date, default: () => new Date() },
  resolved_at:  { type: Date },

  description: { type: String },
  photo_url:   { type: String },
  is_clustered:     { type: Boolean, default: false },
  parent_report_id: { type: String, default: null },
};

/**
 * Schema-level constants – consumed by barrierService.ts for
 * business logic without requiring a live Mongoose connection.
 */
export const SCHEMA_INDEXES = [
  { fields: { location: '2dsphere' } },                        // Spatial 2D sphere
  { fields: { status: 1, expires_at: 1 } },                   // TTL cleaner query
  { fields: { osm_way_id: 1, status: 1 } },                   // Routing edge lookup
  { fields: { confidence_score: -1 } },                        // Ranking
  { fields: { user_id: 1, created_at: -1 } },                  // Per-user history
];

// MongoDB TTL index for automatic document expiry
// Creates a Mongo-native TTL sweeper (complements our app-level worker)
export const MONGO_TTL_INDEX = {
  fields: { expires_at: 1 },
  options: { expireAfterSeconds: 0 }, // Expire precisely at expires_at value
};
