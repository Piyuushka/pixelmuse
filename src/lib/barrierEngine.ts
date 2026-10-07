import { Coordinates, calculateHaversineDistance, getQuadKey } from './spatial';

export type RoadLayer = 'flyover' | 'service_road' | 'at_grade';

export interface IndianBarrierReport {
  id: string;
  title: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  microLocation?: string;
  estimatedResolutionTime?: string;
  affectsActiveRoute?: boolean;
  status: 'Reported' | 'Verified' | 'Under Review' | 'Resolved' | 'Expired';
  votes: number;
  downvotes: number;
  date: string;
  reportedAt: number; // Unix timestamp ms — for relative time display
  reportedBy: string;  // Source attribution label
  createdAt: number; // Unix timestamp ms
  expiresAt: number; // Unix timestamp ms
  ttlSeconds: number;
  initialTtlSeconds: number;
  description: string;
  coordinates: Coordinates;
  roadLayer: RoadLayer;
  quadKey: string;
  clusterCount: number;
  isExpired: boolean;
}

export const CATEGORY_TTL_SECONDS: Record<string, number> = {
  // Outages
  'Elevator Out of Service / Escalator Down': 21600, // 6 hours
  'Elevator Outage': 21600,
  // Surface / Weather
  'Puddles / Waterlogging': 7200,      // 2 hours
  'Mud / Loose Gravel': 14400,         // 4 hours
  'Flooding/Waterlogging': 7200,
  // Construction
  'Blockade / Scaffolding on Curb Cut': 43200, // 12 hours
  'Construction': 43200,
  'Construction Obstruction': 43200,
  // Physical / Infrastructure
  'Blocked Ramp/Flyover': 3600,       // 1 hour
  'Blocked Flyover': 3600,
  'Police Checkpoint/Barricade': 10800,// 3 hours
  'Police Checkpoint': 10800,
  'Fallen Tree/Pothole Obstruction': 14400, // 4 hours
  'Missing Curb Cut': 28800,          // 8 hours
  'Door Sensor Malfunction': 14400,
  'Steep Slope Ramp': 28800,
  'Other Hazard': 14400,
};

export function getDefaultTtlForCategory(category: string): number {
  for (const [key, ttl] of Object.entries(CATEGORY_TTL_SECONDS)) {
    if (category.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(category.toLowerCase())) {
      return ttl;
    }
  }
  return 14400; // Default 4 hours
}

/**
 * Creates a brand new IndianBarrierReport object initialized with spatial index and TTL bounds.
 */
export function createBarrierReport(input: {
  title: string;
  category: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  microLocation?: string;
  estimatedResolutionTime?: string;
  affectsActiveRoute?: boolean;
  description?: string;
  coordinates?: Coordinates;
  roadLayer?: RoadLayer;
}): IndianBarrierReport {
  const now = Date.now();
  const ttl = getDefaultTtlForCategory(input.category);
  const coords = input.coordinates || { lat: 19.0760, lng: 72.8777 }; // Default Mumbai / Urban core lat/lng
  const layer = input.roadLayer || 'at_grade';

  const hours = Math.floor(ttl / 3600);
  const mins = Math.floor((ttl % 3600) / 60);
  const formattedEstTime = input.estimatedResolutionTime || (mins > 0 ? `Est. ${hours}h ${mins}m` : `Est. ${hours}h`);

  const affectsRoute = typeof input.affectsActiveRoute === 'boolean'
    ? input.affectsActiveRoute
    : (
        input.title.toLowerCase().includes('elevator') ||
        input.title.toLowerCase().includes('concourse') ||
        input.title.toLowerCase().includes('ramp') ||
        input.location.toLowerCase().includes('concourse') ||
        input.location.toLowerCase().includes('entrance') ||
        input.location.toLowerCase().includes('gate') ||
        input.severity === 'critical'
      );

  return {
    id: `rep-${now}-${Math.floor(Math.random() * 1000)}`,
    title: input.title,
    category: input.category,
    severity: input.severity || 'high',
    location: input.location,
    microLocation: input.microLocation || input.location,
    estimatedResolutionTime: formattedEstTime,
    affectsActiveRoute: affectsRoute,
    status: 'Reported',
    votes: 1,
    downvotes: 0,
    date: 'Just now',
    reportedAt: now,
    reportedBy: 'Community Navigator',
    createdAt: now,
    expiresAt: now + ttl * 1000,
    ttlSeconds: ttl,
    initialTtlSeconds: ttl,
    description: input.description || 'Submitted by community navigator.',
    coordinates: coords,
    roadLayer: layer,
    quadKey: getQuadKey(coords),
    clusterCount: 1,
    isExpired: false,
  };
}

/**
 * 20-Meter Clustering Engine:
 * Searches existing active barriers. If a barrier of same category & layer exists within 20m,
 * merges submission into existing report (increments vote & extends TTL).
 * Otherwise creates and appends a new report.
 */
export function processIncomingBarrierReport(
  existingReports: IndianBarrierReport[],
  newInput: {
    title: string;
    category: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    location: string;
    microLocation?: string;
    estimatedResolutionTime?: string;
    affectsActiveRoute?: boolean;
    description?: string;
    coordinates?: Coordinates;
    roadLayer?: RoadLayer;
  },
  clusteringRadiusMeters: number = 20
): { updatedReports: IndianBarrierReport[]; merged: boolean; targetId: string } {
  const coords = newInput.coordinates || { lat: 19.0760, lng: 72.8777 };
  const layer = newInput.roadLayer || 'at_grade';

  const now = Date.now();

  // Find candidate for merging within 20m
  const matchingIndex = existingReports.findIndex(rep => {
    if (rep.isExpired || rep.status === 'Expired' || rep.status === 'Resolved') return false;
    
    // Check road layer matching (flyover vs service road distinction)
    if (rep.roadLayer !== layer) return false;

    // Check distance
    const dist = calculateHaversineDistance(rep.coordinates, coords);
    return dist <= clusteringRadiusMeters;
  });

  if (matchingIndex !== -1) {
    const existing = existingReports[matchingIndex];
    const ttlBonus = 1800 * 1000; // +30 minutes
    const maxExpiry = now + existing.initialTtlSeconds * 2000; // Max cap 2x initial TTL
    const newExpiresAt = Math.min(existing.expiresAt + ttlBonus, maxExpiry);

    const updatedMerged: IndianBarrierReport = {
      ...existing,
      votes: existing.votes + 1,
      clusterCount: existing.clusterCount + 1,
      expiresAt: newExpiresAt,
      ttlSeconds: Math.max(0, Math.floor((newExpiresAt - now) / 1000)),
      date: 'Updated just now',
      description: `${existing.description} | Re-confirmed by community navigator.`,
      status: existing.votes + 1 >= 3 ? 'Verified' : existing.status,
    };

    const nextList = [...existingReports];
    nextList[matchingIndex] = updatedMerged;
    return { updatedReports: nextList, merged: true, targetId: existing.id };
  }

  // Create new report if no close duplicate found
  const brandNew = createBarrierReport(newInput);
  return { updatedReports: [brandNew, ...existingReports], merged: false, targetId: brandNew.id };
}

/**
 * Upvote handler: extends TTL by 30 mins and updates status to Verified if votes >= 3.
 */
export function upvoteBarrier(reports: IndianBarrierReport[], id: string): IndianBarrierReport[] {
  const now = Date.now();
  return reports.map(r => {
    if (r.id !== id) return r;
    const extensionMs = 1800 * 1000;
    const maxExpiresAt = now + r.initialTtlSeconds * 2000;
    const newExpiresAt = Math.min(r.expiresAt + extensionMs, maxExpiresAt);
    const newVotes = r.votes + 1;
    return {
      ...r,
      votes: newVotes,
      expiresAt: newExpiresAt,
      ttlSeconds: Math.max(0, Math.floor((newExpiresAt - now) / 1000)),
      status: newVotes >= 3 ? 'Verified' : r.status,
    };
  });
}

/**
 * Downvote handler: reduces TTL by 45 mins (-2700s).
 * Auto-expires if downvotes > votes + 2 or TTL <= 0.
 */
export function downvoteBarrier(reports: IndianBarrierReport[], id: string): IndianBarrierReport[] {
  const now = Date.now();
  return reports.map(r => {
    if (r.id !== id) return r;
    const reductionMs = 2700 * 1000;
    const newExpiresAt = r.expiresAt - reductionMs;
    const newDownvotes = r.downvotes + 1;
    const isExpired = newExpiresAt <= now || newDownvotes >= r.votes + 3;

    return {
      ...r,
      downvotes: newDownvotes,
      expiresAt: newExpiresAt,
      ttlSeconds: Math.max(0, Math.floor((newExpiresAt - now) / 1000)),
      isExpired,
      status: isExpired ? 'Expired' : r.status,
    };
  });
}

/**
 * Periodically called decay tick processor to expire elapsed barriers.
 */
export function tickBarrierDecay(reports: IndianBarrierReport[]): IndianBarrierReport[] {
  const now = Date.now();
  return reports.map(r => {
    if (r.isExpired || r.status === 'Expired') return r;
    const remainingMs = r.expiresAt - now;
    if (remainingMs <= 0) {
      return {
        ...r,
        ttlSeconds: 0,
        isExpired: true,
        status: 'Expired',
      };
    }
    return {
      ...r,
      ttlSeconds: Math.floor(remainingMs / 1000),
    };
  });
}
