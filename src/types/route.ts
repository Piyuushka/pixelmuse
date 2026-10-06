export interface RouteRequest {
  start: {
    lat: number;
    lng: number;
  };
  end: {
    lat: number;
    lng: number;
  };
  profile: string; // 'wheelchair', 'older-adult', 'low-vision', 'caregiver'
}

export interface RouteMetrics {
  distance: number; // in meters
  estimatedTime: number; // in minutes
}

export interface RouteResponse {
  route: any; // GeoJSON FeatureCollection
  metrics: RouteMetrics;
}
