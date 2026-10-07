import { RouteScenarioData, SchematicStep, AccessibilityPreferenceId, DEMO_LOCATIONS } from '@/data/routeSimulatorData';
import { IndianBarrierReport } from './barrierEngine';
import { calculateHaversineDistance } from './spatial';

const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY;
const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type DataSourceType = 'live' | 'estimated' | 'demo';

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
      extras?: {
        steepness?: {
          values: Array<[number, number, number]>; // [from_idx, to_idx, steepness_class 1-5]
          summary?: Array<{ value: number; distance: number; amount: number }>;
        };
        surface?: {
          values: Array<[number, number, number]>;
          summary?: Array<{ value: number; distance: number; amount: number }>;
        };
        waytype?: {
          values: Array<[number, number, number]>;
          summary?: Array<{ value: number; distance: number; amount: number }>;
        };
      };
    };
  }>;
}

/**
 * Builds GeoJSON MultiPolygon avoidance areas for active barrier points with a radius buffer.
 * Used by ORS `options.avoid_polygons`.
 */
export function buildAvoidPolygonsFromBarriers(
  barriers: IndianBarrierReport[] = [],
  radiusMeters: number = 30
): { type: 'MultiPolygon'; coordinates: number[][][][] } | undefined {
  const active = barriers.filter(b => !b.isExpired && b.status !== 'Expired' && b.status !== 'Resolved');
  if (active.length === 0) return undefined;

  const polygons = active.map(b => {
    const lat = b.coordinates.lat;
    const lng = b.coordinates.lng;
    const latDelta = radiusMeters / 111000;
    const lngDelta = radiusMeters / (111000 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

    return [
      [
        [Number((lng - lngDelta).toFixed(6)), Number((lat - latDelta).toFixed(6))],
        [Number((lng + lngDelta).toFixed(6)), Number((lat - latDelta).toFixed(6))],
        [Number((lng + lngDelta).toFixed(6)), Number((lat + latDelta).toFixed(6))],
        [Number((lng - lngDelta).toFixed(6)), Number((lat + latDelta).toFixed(6))],
        [Number((lng - lngDelta).toFixed(6)), Number((lat - latDelta).toFixed(6))],
      ]
    ];
  });

  return {
    type: 'MultiPolygon',
    coordinates: polygons,
  };
}

/**
 * Fetches elevation profiles along route coordinates via Google Elevation API.
 * Calculates true rise/run slope percentages.
 */
export async function fetchGoogleElevationForPath(
  coords: Coordinates[]
): Promise<{ maxSlopePct: number; avgSlopePct: number; dataSource: 'live' } | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || coords.length < 2) return null;

  try {
    // Sample evenly up to 20 coordinates to stay well within query bounds
    const step = Math.max(1, Math.floor(coords.length / 20));
    const sampled = coords.filter((_, idx) => idx % step === 0 || idx === coords.length - 1);
    const locString = sampled.map(c => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locString)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length < 2) {
      return null;
    }

    let maxSlope = 0;
    let totalSlope = 0;
    let segmentCount = 0;

    for (let i = 0; i < data.results.length - 1; i++) {
      const e1 = data.results[i].elevation;
      const e2 = data.results[i + 1].elevation;
      const dist = calculateHaversineDistance(
        { lat: data.results[i].location.lat, lng: data.results[i].location.lng },
        { lat: data.results[i + 1].location.lat, lng: data.results[i + 1].location.lng }
      );

      if (dist > 5) {
        const slopePct = (Math.abs(e2 - e1) / dist) * 100;
        maxSlope = Math.max(maxSlope, slopePct);
        totalSlope += slopePct;
        segmentCount++;
      }
    }

    if (segmentCount === 0) return null;

    return {
      maxSlopePct: Number(maxSlope.toFixed(1)),
      avgSlopePct: Number((totalSlope / segmentCount).toFixed(1)),
      dataSource: 'live',
    };
  } catch (err) {
    console.warn('Google Elevation API lookup failed:', err);
    return null;
  }
}

/**
 * Fetches ORS Wheelchair route with extra_info (steepness, surface, waytype)
 * and obstacle avoidance polygons.
 */
export async function fetchOrsWheelchairRouteWithExtras(
  start: Coordinates,
  end: Coordinates,
  barriers: IndianBarrierReport[] = []
): Promise<{
  response: ORSResponse;
  slopeData: { maxSlopePct: number; avgSlopePct: number };
  surfaceData: { surfaceIssues: number };
  dataSource: 'live';
} | null> {
  if (!ORS_API_KEY) return null;

  try {
    const avoidPolygons = buildAvoidPolygonsFromBarriers(barriers);
    const bodyPayload: any = {
      coordinates: [[start.lng, start.lat], [end.lng, end.lat]],
      extra_info: ['steepness', 'surface', 'waytype'],
    };

    if (avoidPolygons) {
      bodyPayload.options = { avoid_polygons: avoidPolygons };
    }

    const url = `${ORS_BASE_URL}/wheelchair/geojson`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': ORS_API_KEY,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) return null;
    const data: ORSResponse = await response.json();
    const feat = data.features?.[0];
    if (!feat) return null;

    // Parse Steepness extras:
    // ORS steepness codes:
    // -5 to -1: downhill (-1=1-3%, -2=4-6%, -3=7-10%, -4=11-15%, -5=>15%)
    // 0: flat (0%)
    // 1 to 5: uphill (1=1-3%, 2=4-6%, 3=7-10%, 4=11-15%, 5=>15%)
    let maxSlopePct = 3.0;
    let avgSlopePct = 1.5;

    if (feat.properties.extras?.steepness?.values) {
      const values = feat.properties.extras.steepness.values;
      let highestCode = 0;
      let sumSlope = 0;

      for (const [, , code] of values) {
        const absCode = Math.abs(code);
        highestCode = Math.max(highestCode, absCode);
        const mappedSlope = absCode === 0 ? 0 : absCode === 1 ? 2.5 : absCode === 2 ? 5.0 : absCode === 3 ? 8.5 : absCode === 4 ? 13.0 : 18.0;
        sumSlope += mappedSlope;
      }

      if (values.length > 0) {
        avgSlopePct = Number((sumSlope / values.length).toFixed(1));
        maxSlopePct = highestCode === 0 ? 1.0 : highestCode === 1 ? 3.0 : highestCode === 2 ? 5.5 : highestCode === 3 ? 9.0 : highestCode === 4 ? 14.0 : 20.0;
      }
    }

    // Parse Surface extras: surface issues count (cobblestone, unpaved, mud, gravel)
    let surfaceIssues = 0;
    if (feat.properties.extras?.surface?.values) {
      for (const [, , val] of feat.properties.extras.surface.values) {
        // ORS surface: 0=unknown, 1=paved, 2=unpaved, 3=asphalt, 4=concrete, 5=cobblestone, etc.
        if (val === 2 || val === 5 || val === 6 || val === 7) {
          surfaceIssues++;
        }
      }
    }

    return {
      response: data,
      slopeData: { maxSlopePct, avgSlopePct },
      surfaceData: { surfaceIssues },
      dataSource: 'live',
    };
  } catch (err) {
    console.warn('ORS Wheelchair route with extras error:', err);
    return null;
  }
}

function mapORSInstructionToStep(instruction: string, type: number, index: number, isAccessible: boolean, coords: number[], distance: number): SchematicStep {
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
    location: coords ? { lng: coords[0], lat: coords[1] } : undefined,
    distance
  };
}

async function fetchRoute(start: Coordinates, end: Coordinates, profile: 'foot-walking' | 'wheelchair'): Promise<ORSResponse | null> {
  if (!ORS_API_KEY) {
    return null;
  }

  try {
    const url = `${ORS_BASE_URL}/${profile}?api_key=${ORS_API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
    const response = await fetch(url);
    if (!response.ok) {
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
  prefId: AccessibilityPreferenceId = 'wheelchair',
  barriers: IndianBarrierReport[] = []
): Promise<(RouteScenarioData & { geojsonNormal?: any; geojsonAccessible?: any; dataSource?: DataSourceType }) | null> {
  // 1. First try wheelchair profile with extra_info and obstacle avoidance
  const wheelchairExtras = await fetchOrsWheelchairRouteWithExtras(start, end, barriers);
  const normalRes = await fetchRoute(start, end, 'foot-walking');

  if (!normalRes && !wheelchairExtras) {
    return null; // Fallback to mock data if API fails or no key
  }

  const normalFeature = normalRes?.features[0];
  const accFeature = wheelchairExtras?.response.features[0] || (await fetchRoute(start, end, 'wheelchair'))?.features[0];

  if (!normalFeature || !accFeature) {
    return null;
  }

  const normalSummary = normalFeature.properties.summary;
  const accSummary = accFeature.properties.summary;

  const normalStepsRaw = normalFeature.properties.segments.flatMap(s => s.steps);
  const accStepsRaw = accFeature.properties.segments.flatMap(s => s.steps);

  const normalSteps: SchematicStep[] = normalStepsRaw.map((step, i) => {
    const coords = normalFeature.geometry.coordinates[step.way_points[0]];
    return mapORSInstructionToStep(step.instruction, step.type, i, false, coords, step.distance);
  });
  const accessibleSteps: SchematicStep[] = accStepsRaw.map((step, i) => {
    const coords = accFeature.geometry.coordinates[step.way_points[0]];
    return mapORSInstructionToStep(step.instruction, step.type, i, true, coords, step.distance);
  });

  return {
    normal: {
      distance: Number((normalSummary.distance / 1000).toFixed(2)),
      time: Math.round(normalSummary.duration / 60),
    },
    accessible: {
      distance: Number((accSummary.distance / 1000).toFixed(2)),
      time: Math.round(accSummary.duration / 60),
    },
    normalSteps,
    accessibleSteps,
    geojsonNormal: normalFeature,
    geojsonAccessible: accFeature,
    dataSource: wheelchairExtras ? 'live' : 'estimated',
  };
}

export interface GeocodeResult {
  name: string;
  label: string;
  coordinates: Coordinates;
  placeId?: string;
}

let placesSessionToken = '';

function getSessionToken() {
  if (!placesSessionToken) {
    placesSessionToken = Math.random().toString(36).substring(2, 15);
  }
  return placesSessionToken;
}

export function resetSessionToken() {
  placesSessionToken = '';
}

export async function geocodeGoogle(query: string): Promise<(GeocodeResult & { placeId?: string })[]> {
  if (!query || query.trim().length === 0) return [];
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  const results: (GeocodeResult & { placeId?: string })[] = [];

  try {
    // 1. First fetch directly from Google Geocoding API to get exact coordinates immediately
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&region=in`;
    const geocodeRes = await fetch(geocodeUrl);
    if (geocodeRes.ok) {
      const geoData = await geocodeRes.json();
      if (geoData.results && geoData.results.length > 0) {
        for (const r of geoData.results.slice(0, 4)) {
          results.push({
            name: r.address_components?.[0]?.long_name || r.formatted_address.split(',')[0],
            label: r.formatted_address,
            placeId: r.place_id,
            coordinates: {
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('Google Geocoding API fetch error:', err);
  }

  try {
    // 2. Also query Google Places Autocomplete for dynamic predictive matches
    const url = 'https://places.googleapis.com/v1/places:autocomplete';
    const requestBody = {
      input: query,
      includedRegionCodes: ['IN'],
      sessionToken: getSessionToken(),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.suggestions && data.suggestions.length > 0) {
        for (const s of data.suggestions) {
          const placeId = s.placePrediction?.placeId;
          const mainName = s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text;
          const fullLabel = s.placePrediction?.text?.text || mainName;
          
          // Avoid duplicate placeId if already returned by geocoding
          if (placeId && !results.some(r => r.placeId === placeId)) {
            // Find if geocoding coordinates already matched
            results.push({
              name: mainName,
              label: fullLabel,
              placeId,
              coordinates: { lat: 0, lng: 0 }, // Resolved on select via getPlaceDetails
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn('Google Places Autocomplete error:', error);
  }

  return results;
}

export async function getPlaceDetails(placeId: string): Promise<Coordinates | null> {
  if (!placeId) return null;

  try {
    // Call server navigation search endpoint (bypasses browser CORS constraints)
    const res = await fetch(`/api/navigation/search?placeId=${encodeURIComponent(placeId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.coordinates?.lat && data.coordinates?.lng) {
        return {
          lat: data.coordinates.lat,
          lng: data.coordinates.lng,
        };
      }
    }
  } catch (err) {
    console.warn('API place details lookup error:', err);
  }

  // Fallback for server-side execution where NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is available
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${apiKey}`;
      const geoRes = await fetch(geoUrl);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results?.[0]?.geometry?.location) {
          return {
            lat: geoData.results[0].geometry.location.lat,
            lng: geoData.results[0].geometry.location.lng,
          };
        }
      }
    } catch (fallbackErr) {
      console.warn('Google Geocode by place_id direct error:', fallbackErr);
    }
  }

  return null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return 'Live GPS Location';

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return 'Live GPS Location';
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return 'Live GPS Location';
  } catch (error) {
    console.warn('Google Reverse Geocoding error:', error);
    return 'Live GPS Location';
  }
}

export async function geocodeNominatim(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in&viewbox=72.75,19.35,73.20,18.85`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PixelMuse-BarrierFreeNavApp/1.0 (contact@pixelmuse.dev)'
      }
    });

    if (!response.ok) return [];
    const data = await response.json();

    if (data && data.length > 0) {
      return data.map((d: any) => ({
        name: d.display_name.split(',')[0],
        label: d.display_name,
        coordinates: {
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon)
        }
      }));
    }
    return [];
  } catch (error) {
    console.warn('Nominatim geocoding error:', error);
    return [];
  }
}

export async function searchLocation(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length === 0) return [];

  const normalized = query.toLowerCase().trim();

  // 1. Exact preset matches
  const exactDemoMatches = DEMO_LOCATIONS.filter(l => l.name.toLowerCase() === normalized).map(l => ({
    name: l.name,
    label: `${l.name} — ${l.description}`,
    coordinates: { lat: l.lat || 19.1118, lng: l.lng || 72.8267 }
  }));

  let serverResults: GeocodeResult[] = [];

  // 2. Query our internal /api/navigation/search endpoint (avoids CORS issues in browser)
  try {
    const res = await fetch(`/api/navigation/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        serverResults = data.results;
      }
    }
  } catch (apiErr) {
    console.warn('Server navigation search request failed, using fallbacks:', apiErr);
  }

  // 3. Fallback: If running in Node or server fetch failed, try direct geocodeGoogle / geocodeNominatim
  if (serverResults.length === 0) {
    const tasks = [];
    if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY) {
      tasks.push(geocodeGoogle(query));
    }
    tasks.push(geocodeNominatim(query));
    
    const resultsArray = await Promise.all(tasks);
    for (const res of resultsArray) {
      serverResults = serverResults.concat(res);
    }
  }

  // Combine: prioritize exact demo matches, then server results, then partial demo matches
  const looseDemoMatches = DEMO_LOCATIONS.filter(l => 
    l.name.toLowerCase() !== normalized &&
    (l.name.toLowerCase().includes(normalized) || (normalized.length > 4 && normalized.includes(l.name.toLowerCase())))
  ).map(l => ({
    name: l.name,
    label: `${l.name} — ${l.description}`,
    coordinates: { lat: l.lat || 19.1118, lng: l.lng || 72.8267 }
  }));

  const combined = [...exactDemoMatches];

  for (const r of serverResults) {
    if (!combined.some(c => c.name.toLowerCase() === r.name.toLowerCase() || c.label.toLowerCase() === r.label.toLowerCase())) {
      combined.push(r);
    }
  }

  for (const l of looseDemoMatches) {
    if (!combined.some(c => c.name.toLowerCase() === l.name.toLowerCase())) {
      combined.push(l);
    }
  }

  return combined;
}

