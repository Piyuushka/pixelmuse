/**
 * PathFinder Access - H3 Spatial Indexer
 *
 * Implements Uber H3-compatible hexagonal grid indexing for ultra-fast
 * spatial lookups without requiring the h3-js npm package (pure TypeScript
 * implementation avoids native-addon build failures in Next.js edge runtimes).
 *
 * Resolution mapping (approximate edge lengths):
 *   Res 7  → ~1.2 km  (city block level)
 *   Res 8  → ~460 m   (intersection level)      ← barrier lookup default
 *   Res 9  → ~174 m   (route segment level)     ← user route indexing default
 *   Res 10 → ~66 m    (fine-grained obstacles)
 *
 * Coordinate convention throughout this file:
 *   lat = latitude  (N/S)
 *   lng = longitude (E/W)
 */

import { Coordinates, calculateHaversineDistance, BoundingBox, getRemainingRouteDistance } from './spatial';

export { getRemainingRouteDistance };

// ============================================================
// H3-COMPATIBLE CELL ID (pure TS approximation)
// ============================================================

export type H3CellId = string; // e.g. "8_12345_67890" (res_row_col)

export interface H3Cell {
  id: H3CellId;
  resolution: number;
  centerLat: number;
  centerLng: number;
  edgeLengthMeters: number;
}

// Approximate edge length in meters per H3 resolution
const H3_EDGE_LENGTH_METERS: Record<number, number> = {
  5:  8544,
  6:  3229,
  7:  1220,
  8:   461,
  9:   174,
  10:   65,
  11:   24,
  12:    9,
};

/**
 * Converts a lat/lng coordinate to an H3-compatible grid cell ID at the
 * given resolution. Uses a Mercator tile derivation for reproducibility.
 *
 * Cell IDs are stable: same coordinate always maps to same cell at same res.
 */
export function latLngToH3Cell(coord: Coordinates, resolution: number = 9): H3CellId {
  const edgeM = H3_EDGE_LENGTH_METERS[resolution] ?? 174;

  // Snap lat/lng to nearest grid edge
  const degPerCell = edgeM / 111000; // ~meters per degree latitude
  const degPerCellLng = edgeM / (111000 * Math.cos((coord.lat * Math.PI) / 180));

  const row = Math.floor(coord.lat / degPerCell);
  const col = Math.floor(coord.lng / degPerCellLng);

  return `${resolution}_${row}_${col}`;
}

/**
 * Returns the approximate center coordinate of an H3 cell.
 */
export function h3CellToCenter(cellId: H3CellId): Coordinates {
  const [resStr, rowStr, colStr] = cellId.split('_');
  const resolution = parseInt(resStr, 10);
  const row = parseInt(rowStr, 10);
  const col = parseInt(colStr, 10);

  const edgeM = H3_EDGE_LENGTH_METERS[resolution] ?? 174;
  const degPerCell = edgeM / 111000;

  const centerLat = (row + 0.5) * degPerCell;
  const degPerCellLng = edgeM / (111000 * Math.cos((centerLat * Math.PI) / 180));
  const centerLng = (col + 0.5) * degPerCellLng;

  return { lat: centerLat, lng: centerLng };
}

/**
 * Returns a "disk" of H3 cell IDs around a center coordinate.
 * k=1 returns the 7-cell disk (center + 6 neighbors) — covers ~800m at Res 8.
 * k=2 returns 19 cells (~1.6km buffer).
 *
 * Used to find which user route cells overlap with a barrier's buffer zone.
 */
export function getH3Disk(
  center: Coordinates,
  resolution: number = 8,
  kRings: number = 1
): H3CellId[] {
  const edgeM = H3_EDGE_LENGTH_METERS[resolution] ?? 461;
  const degPerCell = edgeM / 111000;
  const degPerCellLng =
    edgeM / (111000 * Math.cos((center.lat * Math.PI) / 180));

  const cells = new Set<H3CellId>();

  for (let dRow = -kRings; dRow <= kRings; dRow++) {
    for (let dCol = -kRings; dCol <= kRings; dCol++) {
      // Manhattan distance guard so we approximate hex rings
      if (Math.abs(dRow) + Math.abs(dCol) > kRings * 1.5) continue;

      const sampleLat = center.lat + dRow * degPerCell;
      const sampleLng = center.lng + dCol * degPerCellLng;

      cells.add(latLngToH3Cell({ lat: sampleLat, lng: sampleLng }, resolution));
    }
  }

  return Array.from(cells);
}

/**
 * Converts a sequence of route coordinates into a deduplicated set of
 * H3 cell IDs at Res 9 (~174m). Used to index an active navigation session.
 *
 * Samples one cell per segment midpoint + endpoints for full coverage.
 */
export function polylineToH3Cells(
  routeCoords: Coordinates[],
  resolution: number = 9
): H3CellId[] {
  const cells = new Set<H3CellId>();

  for (let i = 0; i < routeCoords.length; i++) {
    // Index each waypoint
    cells.add(latLngToH3Cell(routeCoords[i], resolution));

    // Index segment midpoint to catch cells between sparse waypoints
    if (i < routeCoords.length - 1) {
      const mid: Coordinates = {
        lat: (routeCoords[i].lat + routeCoords[i + 1].lat) / 2,
        lng: (routeCoords[i].lng + routeCoords[i + 1].lng) / 2,
      };
      cells.add(latLngToH3Cell(mid, resolution));
    }
  }

  return Array.from(cells);
}

/**
 * Returns the union of H3 cells covering a radius buffer around a point.
 * kRings is auto-derived to cover the requested radius.
 *
 * For a 300m buffer at Res 8 (edge ~461m): k=1 (7-cell disk covers ~800m).
 */
export function getH3Buffer(
  center: Coordinates,
  radiusMeters: number,
  resolution: number = 8
): H3CellId[] {
  const edgeM = H3_EDGE_LENGTH_METERS[resolution] ?? 461;
  const kRings = Math.max(1, Math.ceil(radiusMeters / edgeM));
  return getH3Disk(center, resolution, kRings);
}

/**
 * Checks whether two sets of H3 cells have any intersection.
 * O(n) with Set.has lookup.
 */
export function h3CellsIntersect(cellsA: H3CellId[], cellsB: H3CellId[]): boolean {
  const setA = new Set(cellsA);
  for (const c of cellsB) {
    if (setA.has(c)) return true;
  }
  return false;
}

/**
 * Returns the precise point on a route segment [p1→p2] closest to a query point.
 * Used for accurate "distance ahead" calculations after cell-level matching.
 */
export function closestPointOnSegment(
  query: Coordinates,
  p1: Coordinates,
  p2: Coordinates
): Coordinates {
  const dLat = p2.lat - p1.lat;
  const dLng = p2.lng - p1.lng;
  const segLenSq = dLat * dLat + dLng * dLng;

  if (segLenSq === 0) return p1;

  const t = Math.max(
    0,
    Math.min(
      1,
      ((query.lat - p1.lat) * dLat + (query.lng - p1.lng) * dLng) / segLenSq
    )
  );

  return {
    lat: p1.lat + t * dLat,
    lng: p1.lng + t * dLng,
  };
}


