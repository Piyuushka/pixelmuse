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

// Sample Data: To be replaced with real surveyed points
export const entrances: Entrance[] = [
  {
    id: 'ent-1',
    siteId: 'site-bldg-b',
    name: 'Main Gate',
    lat: 40.7128,
    lng: -74.0060,
    stepFree: false,
    stepCount: 6,
    hasRamp: false,
    hasLift: false,
    doorType: 'heavy',
    width: 150,
    hasTactilePaving: false,
    isWellLit: true,
    source: 'Official',
    lastVerified: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    confirmations: 120,
    disputes: 2,
    notes: 'Main entrance with grand stairs.'
  },
  {
    id: 'ent-2',
    siteId: 'site-bldg-b',
    name: 'Side Entrance',
    lat: 40.7129,
    lng: -74.0061,
    stepFree: true,
    stepCount: 0,
    hasRamp: true,
    hasLift: false,
    doorType: 'automatic',
    rampSlopePercent: 6,
    width: 120,
    hasTactilePaving: true,
    isWellLit: true,
    source: 'Community',
    lastVerified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    confirmations: 45,
    disputes: 0,
    notes: 'Ramp access located on the west side.'
  },
  {
    id: 'ent-3',
    siteId: 'site-bldg-b',
    name: 'Service Lift Lobby',
    lat: 40.7127,
    lng: -74.0059,
    stepFree: true,
    stepCount: 0,
    hasRamp: false,
    hasLift: true,
    doorType: 'manual',
    width: 90,
    hasTactilePaving: false,
    isWellLit: false,
    source: 'Survey',
    lastVerified: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    confirmations: 15,
    disputes: 5,
    notes: 'Level 3 reached by lift on the left. Dimly lit.'
  },
  {
    id: 'ent-4',
    siteId: 'site-bldg-b',
    name: 'East Wing Door',
    lat: 40.7128,
    lng: -74.0058,
    stepFree: false,
    stepCount: 2,
    hasRamp: false,
    hasLift: false,
    doorType: 'automatic',
    width: 110,
    hasTactilePaving: false,
    isWellLit: true,
    source: 'Community',
    lastVerified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    confirmations: 8,
    disputes: 1,
    notes: 'Only 2 steps, but no ramp.'
  }
];
