/**
 * Shared Type Definitions & Interfaces
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteRequest {
  start: LatLng;
  end: LatLng;
  profile: 'wheelchair' | 'older-adult' | 'low-vision' | 'caregiver' | string;
}

export interface RouteMetrics {
  distance: number;       // meters
  estimatedTime: number;  // minutes
}

export interface RouteResponse {
  route: any; // GeoJSON FeatureCollection
  metrics: RouteMetrics;
}

export interface Waypoint {
  id: number | string;
  title: string;
  type: 'origin' | 'step' | 'destination' | 'hazard';
  lat?: number;
  lng?: number;
  description?: string;
  distanceMeters?: number;
  isAccessible?: boolean;
}

export interface AccessibilityPersona {
  id: 'wheelchair' | 'older-adult' | 'low-vision' | 'caregiver';
  title: string;
  description: string;
  iconName?: string;
  maxSlopePercent: number;
  requiresElevator: boolean;
  requiresTactilePaving: boolean;
  maxStepCount: number;
}

export interface BarrierReport {
  id: string;
  lat: number;
  lng: number;
  title: string;
  hazardType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

export interface Entrance {
  id: string;
  siteId: string;
  name: string;
  lat: number;
  lng: number;
  stepFree: boolean;
  stepCount: number;
  hasRamp: boolean;
  hasLift: boolean;
  doorType: 'automatic' | 'manual' | 'heavy';
  rampSlopePercent?: number;
  width?: number;
  hasTactilePaving?: boolean;
  isWellLit?: boolean;
  source: string;
  lastVerified: string;
  confirmations: number;
  disputes: number;
  photoUrl?: string;
  notes?: string;
}
