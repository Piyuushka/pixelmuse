import { RouteRequest, RouteResponse } from '@/types/route';

export async function getRoute(request: RouteRequest): Promise<RouteResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('API routing failed, falling back to offline route', e);
    }
  }

  // Fallback mock GeoJSON route
  return {
    route: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [request.start.lng, request.start.lat],
              [request.end.lng, request.end.lat] // Simple straight line for fallback
            ]
          }
        }
      ]
    },
    metrics: {
      distance: 450,
      estimatedTime: 6,
    }
  };
}
