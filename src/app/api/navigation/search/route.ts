import { NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const placeId = searchParams.get('placeId');

  if (!API_KEY) {
    return NextResponse.json({ error: 'Missing Google Maps API Key' }, { status: 500 });
  }

  // 1. If placeId requested, resolve exact coordinates
  if (placeId) {
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${API_KEY}`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          return NextResponse.json({
            coordinates: { lat: loc.lat, lng: loc.lng },
            formattedAddress: data.results[0].formatted_address,
          });
        }
      }
    } catch (e) {
      console.error('Failed to resolve placeId via server geocode:', e);
    }
    return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  }

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results: any[] = [];

  // 2. Query Google Places Autocomplete first for establishment/place names
  try {
    const autoUrl = 'https://places.googleapis.com/v1/places:autocomplete';
    const autoRes = await fetch(autoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ['IN'],
      }),
    });
    if (autoRes.ok) {
      const autoData = await autoRes.json();
      if (autoData.suggestions && autoData.suggestions.length > 0) {
        for (const s of autoData.suggestions) {
          const pid = s.placePrediction?.placeId;
          const mainName = s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text;
          const fullText = s.placePrediction?.text?.text || mainName;
          if (pid) {
            results.push({
              name: mainName,
              label: fullText,
              placeId: pid,
              coordinates: { lat: 0, lng: 0 },
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Server Places autocomplete failed:', e);
  }

  // 3. Also fetch directly from Google Geocoding API
  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${API_KEY}&region=in`;
    const geoRes = await fetch(geoUrl);
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        for (const r of geoData.results.slice(0, 4)) {
          const pid = r.place_id;
          const existing = results.find(item => item.placeId === pid);
          if (existing) {
            // Enrich existing autocomplete result with exact coordinates
            existing.coordinates = {
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
            };
          } else {
            results.push({
              name: r.address_components?.[0]?.long_name || r.formatted_address.split(',')[0],
              label: r.formatted_address,
              placeId: pid,
              coordinates: {
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
              }
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Server Geocoding API search failed:', e);
  }

  // 4. Resolve coordinates for the top autocomplete results that still have 0,0
  const unplaced = results.filter(r => r.placeId && (!r.coordinates || (r.coordinates.lat === 0 && r.coordinates.lng === 0))).slice(0, 3);
  await Promise.all(
    unplaced.map(async item => {
      try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(item.placeId)}&key=${API_KEY}`;
        const res = await fetch(geoUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.results?.[0]?.geometry?.location) {
            item.coordinates = {
              lat: data.results[0].geometry.location.lat,
              lng: data.results[0].geometry.location.lng,
            };
          }
        }
      } catch (err) {
        // ignore individual resolution error
      }
    })
  );

  return NextResponse.json({ results });
}
