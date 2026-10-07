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

function mapORSInstructionToStep(instruction: string, type: number, index: number, isAccessible: boolean, coords: number[], distance: number): SchematicStep {
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

/**
 * Free public OSRM (Open Source Routing Machine) fallback that requires no API key.
 * Guarantees live route calculation for any start/end coordinates globally.
 */
async function fetchOSRMRoute(start: Coordinates, end: Coordinates): Promise<ORSResponse | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const steps = (route.legs || []).flatMap((leg: any) => leg.steps || []);

    return {
      features: [
        {
          geometry: route.geometry,
          properties: {
            segments: [
              {
                distance: route.distance,
                duration: route.duration,
                steps: steps.map((s: any) => ({
                  distance: s.distance,
                  duration: s.duration,
                  type: s.maneuver?.type === 'arrive' ? 10 : (s.maneuver?.type === 'depart' ? 11 : 6),
                  instruction: s.maneuver?.instruction || s.name || 'Proceed along designated path',
                  name: s.name || '',
                  way_points: [0],
                })),
              },
            ],
            summary: {
              distance: route.distance,
              duration: route.duration,
            },
          },
        },
      ],
    };
  } catch (error) {
    console.warn('OSRM live route fallback error:', error);
    return null;
  }
}

async function fetchRoute(start: Coordinates, end: Coordinates, profile: 'foot-walking' | 'wheelchair'): Promise<ORSResponse | null> {
  if (ORS_API_KEY && !ORS_API_KEY.startsWith('eyJ')) {
    try {
      const url = `${ORS_BASE_URL}/${profile}?api_key=${ORS_API_KEY}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      console.warn(`ORS API Route error (${response.statusText}), falling back to OSRM`);
    } catch (error) {
      console.warn('Failed to fetch ORS route, falling back to OSRM:', error);
    }
  }

  // Automatic OSRM fallback if ORS key is invalid or fails
  return await fetchOSRMRoute(start, end);
}

export async function getLiveRouteScenario(
  start: Coordinates,
  end: Coordinates,
  prefId: AccessibilityPreferenceId = 'wheelchair'
): Promise<(RouteScenarioData & { geojsonNormal?: any, geojsonAccessible?: any }) | null> {
  
  const [normalRes, accessibleRes] = await Promise.all([
    fetchRoute(start, end, 'foot-walking'),
    fetchRoute(start, end, 'wheelchair')
  ]);

  const activeRes = normalRes || accessibleRes;
  if (!activeRes) {
    return null;
  }

  const normalFeature = normalRes ? normalRes.features[0] : activeRes.features[0];
  const accFeature = accessibleRes ? accessibleRes.features[0] : activeRes.features[0];

  const normalSummary = normalFeature.properties.summary;
  const accSummary = accFeature.properties.summary;

  const normalStepsRaw = normalFeature.properties.segments.flatMap(s => s.steps);
  const accStepsRaw = accFeature.properties.segments.flatMap(s => s.steps);

  const normalSteps: SchematicStep[] = normalStepsRaw.map((step, i) => {
    const coords = normalFeature.geometry.coordinates[step.way_points[0] || 0];
    return mapORSInstructionToStep(step.instruction, step.type, i, false, coords, step.distance);
  });
  const accessibleSteps: SchematicStep[] = accStepsRaw.map((step, i) => {
    const coords = accFeature.geometry.coordinates[step.way_points[0] || 0];
    return mapORSInstructionToStep(step.instruction, step.type, i, true, coords, step.distance);
  });

  return {
    normal: {
      distance: Number((normalSummary.distance / 1000).toFixed(2)),
      time: Math.max(1, Math.round(normalSummary.duration / 60)),
    },
    accessible: {
      distance: Number((accSummary.distance / 1000).toFixed(2)),
      time: Math.max(1, Math.round(accSummary.duration / 60)),
    },
    normalSteps,
    accessibleSteps,
    geojsonNormal: normalFeature,
    geojsonAccessible: accFeature
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

<<<<<<< Updated upstream
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
=======
  const demoMatches = DEMO_LOCATIONS.filter(l =>
    l.name.toLowerCase().includes(normalized) || 
    normalized.includes(l.name.toLowerCase()) ||
    (l.description && l.description.toLowerCase().includes(normalized)) ||
    (l.id && l.id.replace(/-/g, ' ').includes(normalized))
>>>>>>> Stashed changes
  ).map(l => ({
    name: l.name,
    label: `${l.name} — ${l.description}`,
    coordinates: { lat: l.lat || 19.1118, lng: l.lng || 72.8267 }
  }));

  const combined = [...exactDemoMatches];

<<<<<<< Updated upstream
  for (const r of serverResults) {
=======
  const tasks = [];
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    tasks.push(geocodeGoogle(query));
  }
  tasks.push(geocodeNominatim(query));
  
  const resultsArray = await Promise.all(tasks);
  
  for (const res of resultsArray) {
    remoteResults = remoteResults.concat(res);
  }

  const combined = [...demoMatches];
  
  for (const r of remoteResults) {
>>>>>>> Stashed changes
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
