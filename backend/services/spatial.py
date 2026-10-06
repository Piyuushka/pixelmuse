"""
services/spatial.py — Off-route deviation engine.

Uses the Haversine formula to compute great-circle distance between two
GPS coordinate pairs. Deviation is detected when the minimum distance
from a live position to ANY segment on the active route exceeds a
configurable threshold (default 50 m).
"""

import math
from typing import List, Tuple

# Deviation threshold in metres — configurable via env if needed
DEFAULT_DEVIATION_THRESHOLD_M = 50.0


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Return the great-circle distance in metres between two WGS-84 points.
    Uses the Haversine formula (accurate to ~0.3% for typical distances).
    """
    R = 6_371_000  # Earth radius in metres

    phi1    = math.radians(lat1)
    phi2    = math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_to_segment_distance_m(
    px: float, py: float,
    ax: float, ay: float,
    bx: float, by: float,
) -> float:
    """
    Minimum distance (metres, Euclidean approximation — valid for short segments)
    from point P to line segment AB.

    We project P onto the line defined by AB, clamp to [0,1], and return
    the distance to the nearest point on the segment.
    """
    ab_lat = bx - ax
    ab_lng = by - ay
    len_sq = ab_lat ** 2 + ab_lng ** 2

    if len_sq == 0:
        # Degenerate segment (A == B)
        return haversine_m(px, py, ax, ay)

    t = max(0.0, min(1.0, ((px - ax) * ab_lat + (py - ay) * ab_lng) / len_sq))
    proj_lat = ax + t * ab_lat
    proj_lng = ay + t * ab_lng

    return haversine_m(px, py, proj_lat, proj_lng)


def min_distance_to_route_m(
    live_lat: float,
    live_lng: float,
    route_coords: List[Tuple[float, float]],
) -> float:
    """
    Return the minimum perpendicular distance (metres) from the live GPS
    point to the nearest segment of the route polyline.

    Args:
        live_lat, live_lng  — current child GPS position
        route_coords        — ordered list of (lat, lng) waypoints forming the route

    Returns:
        Minimum distance in metres to the route polyline.
        Returns distance to nearest waypoint if only 1 waypoint is given.
    """
    if not route_coords:
        raise ValueError("route_coords must contain at least one waypoint")

    if len(route_coords) == 1:
        return haversine_m(live_lat, live_lng, route_coords[0][0], route_coords[0][1])

    min_dist = math.inf
    for i in range(len(route_coords) - 1):
        a_lat, a_lng = route_coords[i]
        b_lat, b_lng = route_coords[i + 1]
        d = _point_to_segment_distance_m(
            live_lat, live_lng,
            a_lat,   a_lng,
            b_lat,   b_lng,
        )
        if d < min_dist:
            min_dist = d

    return min_dist


def check_deviation(
    live_lat:     float,
    live_lng:     float,
    route_coords: List[Tuple[float, float]],
    threshold_m:  float = DEFAULT_DEVIATION_THRESHOLD_M,
) -> Tuple[bool, float]:
    """
    Check whether the child has deviated from the route.

    Returns:
        (is_deviated, distance_m)
        is_deviated — True if distance > threshold
        distance_m  — actual distance to nearest route point
    """
    dist = min_distance_to_route_m(live_lat, live_lng, route_coords)
    return dist > threshold_m, round(dist, 2)
