export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Calculates Haversine distance between two geographic coordinates in meters.
 */
export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes a Tile Quadkey for spatial indexing at specified zoom level (default 18 ~ 15m resolution).
 */
export function getQuadKey(coord: Coordinates, zoom: number = 18): string {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, coord.lat));
  const lng = Math.max(-180, Math.min(180, coord.lng));

  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = Math.floor(
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * Math.pow(2, zoom)
  );

  let quadKey = '';
  for (let i = zoom; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit++;
    if ((y & mask) !== 0) digit += 2;
    quadKey += digit.toString();
  }
  return quadKey;
}

/**
 * Generates a BoundingBox around a route path given a search radius buffer in meters.
 */
export function getRouteBoundingBox(routeCoords: Coordinates[], bufferMeters: number = 50): BoundingBox {
  if (routeCoords.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
  }

  let minLat = routeCoords[0].lat;
  let maxLat = routeCoords[0].lat;
  let minLng = routeCoords[0].lng;
  let maxLng = routeCoords[0].lng;

  for (const c of routeCoords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  // Convert buffer meters to approx degrees (1 deg ~ 111,000 m)
  const latBuffer = bufferMeters / 111000;
  const lngBuffer = bufferMeters / (111000 * Math.cos((minLat * Math.PI) / 180));

  return {
    minLat: minLat - latBuffer,
    maxLat: maxLat + latBuffer,
    minLng: minLng - lngBuffer,
    maxLng: maxLng + lngBuffer,
  };
}

/**
 * Checks if a coordinate point falls inside a given BoundingBox.
 */
export function isPointInBoundingBox(point: Coordinates, bbox: BoundingBox): boolean {
  return (
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat &&
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng
  );
}

/**
 * Calculates the shortest distance in meters from a point to a line segment.
 * Uses a flat-earth approximation which is accurate enough for short distances (< 1km).
 */
export function pointToSegmentDistanceMeters(
  point: Coordinates,
  p1: Coordinates,
  p2: Coordinates
): number {
  const x0 = point.lng;
  const y0 = point.lat;
  const x1 = p1.lng;
  const y1 = p1.lat;
  const x2 = p2.lng;
  const y2 = p2.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return calculateHaversineDistance(point, p1);
  }

  const t = ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));

  const projX = x1 + tClamped * dx;
  const projY = y1 + tClamped * dy;

  return calculateHaversineDistance(point, { lat: projY, lng: projX });
}

/**
 * Determines if a barrier intersects with any segment of a route within a proximity threshold.
 */
export function isBarrierOnRouteSegment(
  barrierCoord: Coordinates,
  routeCoords: Coordinates[],
  proximityMeters: number = 25
): boolean {
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const p1 = routeCoords[i];
    const p2 = routeCoords[i + 1];

    if (pointToSegmentDistanceMeters(barrierCoord, p1, p2) <= proximityMeters) {
      return true;
    }
  }
  return false;
}

/**
 * Determines if a given coordinate point is near ANY part of the provided polyline.
 */
export function isPointNearPolyline(
  point: Coordinates,
  polyline: Coordinates[],
  toleranceMeters: number = 25
): boolean {
  return isBarrierOnRouteSegment(point, polyline, toleranceMeters);
}

/**
 * Computes remaining route distance in meters from a given waypoint index to destination.
 */
export function getRemainingRouteDistance(
  routeCoords: Coordinates[],
  fromIndex: number
): number {
  let total = 0;
  for (let i = fromIndex; i < routeCoords.length - 1; i++) {
    total += calculateHaversineDistance(routeCoords[i], routeCoords[i + 1]);
  }
  return total;
}

/**
 * Standard Google / OSRM Polyline Algorithm (precision 1e5).
 * Encodes an array of coordinates into a compact string representation.
 */
export function encodePolyline(coordinates: Coordinates[]): string {
  let output = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    const latInt = Math.round(coord.lat * 1e5);
    const lngInt = Math.round(coord.lng * 1e5);

    const dLat = latInt - prevLat;
    const dLng = lngInt - prevLng;

    prevLat = latInt;
    prevLng = lngInt;

    output += encodeSignedNumber(dLat);
    output += encodeSignedNumber(dLng);
  }

  return output;
}

function encodeSignedNumber(num: number): string {
  let sgnNum = num < 0 ? ~(num << 1) : num << 1;
  let encoded = '';
  while (sgnNum >= 0x20) {
    encoded += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  encoded += String.fromCharCode(sgnNum + 63);
  return encoded;
}

/**
 * Decodes a standard Google / OSRM Polyline string into an array of Coordinates.
 */
export function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dLng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}
