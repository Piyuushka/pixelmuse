import { RouteScenarioData, SchematicStep, AccessibilityPreferenceId, DEMO_LOCATIONS } from '@/data/routeSimulatorData';

const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY;
const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

export interface Coordinates {
  lat: number;
  lng: number;
}

interface ORSResponse {
  features: Array<{
    geometry: {
      coordinates: number[][]; // [lng, lat]
      type: 'LineString';
    };
    properties: {
      segments: Array<{
        distance: number;
        duration: number;
        steps: Array<{
          distance: number;
          duration: number;
          type: number;
          instruction: string;
          name: string;
          way_points: number[];
        }>;
      }>;
      summary: {
        distance: number;
        duration: number;
      };
    };
  }>;
}

function mapORSInstructionToStep(instruction: string, type: number, index: number, isAccessible: boolean, coords: number[]): SchematicStep {
  // ORS Types (Simplified):
  // 0: Left, 1: Right, 2: Sharp left, 3: Sharp right, 4: Slight left, 5: Slight right, 
  // 6: Straight, 7: Enter roundabout, 8: Exit roundabout, 9: U-turn, 10: Goal, 11: Depart, 12: Keep left, 13: Keep right
  
  let stepType: SchematicStep['type'] = 'smooth_footpath';
  let title = instruction;
  let detail = '';

  if (type === 11) {
    stepType = 'start';
    title = 'Start Journey';
    detail = instruction;
  } else if (type === 10) {
    stepType = 'destination';
    title = 'Arrive at Destination';
    detail = instruction;
  } else if (instruction.toLowerCase().includes('stairs') || instruction.toLowerCase().includes('steps')) {
    stepType = isAccessible ? 'ramp' : 'stair';
    title = isAccessible ? 'Accessible Ramp/Lift' : 'Stairs';
    detail = isAccessible ? 'Step-free alternative' : 'Stairs detected on path';
  } else if (instruction.toLowerCase().includes('cross') || instruction.toLowerCase().includes('street')) {
    stepType = isAccessible ? 'accessible_crossing' : 'unsafe_crossing';
    title = 'Street Crossing';
    detail = isAccessible ? 'Signalized or safe crossing' : 'Crossing with potential traffic';
  } else if (instruction.toLowerCase().includes('roundabout')) {
    stepType = 'barrier';
    title = 'Roundabout Navigation';
    detail = 'Complex traffic intersection';
  }

  return {
    id: `${isAccessible ? 'a' : 'n'}-${index}`,
    title,
    type: stepType,
    detail: detail || instruction,
    avoidedOrResolved: isAccessible && stepType !== 'unsafe_crossing' && stepType !== 'barrier' && stepType !== 'stair',
    location: coords ? { lng: coords[0], lat: coords[1] } : undefined
  };
}

async function fetchRoute(start: Coordinates, end: Coordinates, profile: 'foot-walking' | 'wheelchair'): Promise<ORSResponse | null> {
  if (!ORS_API_KEY) {
    console.warn('ORS API key not found. Using mock data.');
    return null;
  }

  try {
    // Note: ORS expects [lng, lat]
    const url = `${ORS_BASE_URL}/${profile}?api_key=${ORS_API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`ORS API Route not found or error: ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch ORS route:', error);
    return null;
  }
}

export async function getLiveRouteScenario(
  start: Coordinates,
  end: Coordinates,
  prefId: AccessibilityPreferenceId = 'wheelchair'
): Promise<(RouteScenarioData & { geojsonNormal?: any, geojsonAccessible?: any }) | null> {
  
  // 1. Fetch both routes in parallel
  const [normalRes, accessibleRes] = await Promise.all([
    fetchRoute(start, end, 'foot-walking'),
    fetchRoute(start, end, 'wheelchair')
  ]);

  if (!normalRes || !accessibleRes) {
    return null; // Fallback to mock data if API fails or no key
  }

  const normalFeature = normalRes.features[0];
  const accFeature = accessibleRes.features[0];

  const normalSummary = normalFeature.properties.summary;
  const accSummary = accFeature.properties.summary;

  const normalStepsRaw = normalFeature.properties.segments.flatMap(s => s.steps);
  const accStepsRaw = accFeature.properties.segments.flatMap(s => s.steps);

  const normalSteps: SchematicStep[] = normalStepsRaw.map((step, i) => {
    const coords = normalFeature.geometry.coordinates[step.way_points[0]];
    return mapORSInstructionToStep(step.instruction, step.type, i, false, coords);
  });
  const accessibleSteps: SchematicStep[] = accStepsRaw.map((step, i) => {
    const coords = accFeature.geometry.coordinates[step.way_points[0]];
    return mapORSInstructionToStep(step.instruction, step.type, i, true, coords);
  });

  // Count artificial metrics for UI based on string matching since ORS doesn't provide exact barrier counts easily
  const normalStairs = normalSteps.filter(s => s.type === 'stair').length;
  const accStairs = accessibleSteps.filter(s => s.type === 'stair').length;

  const normalCrossings = normalSteps.filter(s => s.type === 'unsafe_crossing').length;
  const accCrossings = accessibleSteps.filter(s => s.type === 'unsafe_crossing').length;

  const normalBarriers = normalSteps.filter(s => s.type === 'barrier').length;
  const accBarriers = accessibleSteps.filter(s => s.type === 'barrier').length;

  const distanceDiff = (accSummary.distance - normalSummary.distance) / 1000;

  return {
    normal: {
      distance: Number((normalSummary.distance / 1000).toFixed(2)),
      time: Math.round(normalSummary.duration / 60),
      stairs: normalStairs,
      maxSlope: 8, // Estimated
      barriers: normalBarriers,
      unsafeCrossings: normalCrossings
    },
    accessible: {
      distance: Number((accSummary.distance / 1000).toFixed(2)),
      time: Math.round(accSummary.duration / 60),
      stairs: accStairs,
      maxSlope: 4, // Estimated
      barriers: accBarriers,
      unsafeCrossings: accCrossings
    },
    normalSteps,
    accessibleSteps,
    whyChanged: [
      `Avoided ${Math.max(0, normalStairs - accStairs)} stair sections by using wheelchair routing.`,
      `Adjusted path to avoid steep inclines and major road barriers.`,
      distanceDiff > 0 ? `Added ${(distanceDiff * 1000).toFixed(0)} meters to ensure step-free passage.` : 'Found a more direct accessible path.'
    ],
    summaryText: `The accessible route prioritizes safety and step-free convenience based on live OpenRouteService data.`,
    geojsonNormal: normalFeature,
    geojsonAccessible: accFeature
  };
}

export interface GeocodeResult {
  name: string;
  label: string;
  coordinates: Coordinates;
}

export async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  if (!query || query.trim().length === 0) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PixelMuse-BarrierFreeNavApp/1.0 (contact@pixelmuse.dev)'
      }
    });

    if (!response.ok) return null;
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        name: data[0].display_name.split(',')[0],
        label: data[0].display_name,
        coordinates: {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        }
      };
    }
    return null;
  } catch (error) {
    console.warn('Nominatim geocoding error:', error);
    return null;
  }
}

export async function searchLocation(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length === 0) return [];

  const normalized = query.toLowerCase().trim();

  // Local fuzzy matching against DEMO_LOCATIONS
  const demoMatches = DEMO_LOCATIONS.filter(l => 
    l.name.toLowerCase().includes(normalized) || 
    normalized.includes(l.name.toLowerCase()) ||
    (l.description && l.description.toLowerCase().includes(normalized)) ||
    (l.id && l.id.replace(/-/g, ' ').includes(normalized))
  ).map(l => ({
    name: l.name,
    label: `${l.name} — ${l.description}`,
    coordinates: { lat: l.lat || 19.1118, lng: l.lng || 72.8267 }
  }));

  if (!ORS_API_KEY) {
    // Try Nominatim online geocoding if ORS key is not available
    const nomRes = await geocodeNominatim(query);
    if (nomRes) {
      const combined = [...demoMatches];
      if (!combined.some(c => c.name.toLowerCase() === nomRes.name.toLowerCase())) {
        combined.unshift(nomRes);
      }
      return combined;
    }
    if (demoMatches.length > 0) return demoMatches;
    return [{
      name: query,
      label: `${query} (Custom Location)`,
      coordinates: { lat: 19.1118, lng: 72.8267 }
    }];
  }

  try {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&boundary.country=IND`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Geocoding failed');
    const data = await response.json();

    const remoteResults: GeocodeResult[] = data.features.map((feature: any) => ({
      name: feature.properties.name,
      label: feature.properties.label,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0]
      }
    }));

    const combined = [...demoMatches];
    for (const r of remoteResults) {
      if (!combined.some(c => c.name.toLowerCase() === r.name.toLowerCase())) {
        combined.push(r);
      }
    }
    return combined;
  } catch (error) {
    console.error('Failed to geocode:', error);
    const nomRes = await geocodeNominatim(query);
    if (nomRes) return [nomRes, ...demoMatches];
    return demoMatches.length > 0 ? demoMatches : [{
      name: query,
      label: `${query} (Custom Location)`,
      coordinates: { lat: 19.1118, lng: 72.8267 }
    }];
  }
}
