"""
ws/tracking.py — WebSocket endpoints for live GPS tracking.

Child endpoint  : ws://.../ws/child/{child_id}
Parent endpoint : ws://.../ws/parent/{child_id}

Child sends:
  { "lat": 28.6139, "lng": 77.2090, "accuracy_m": 5.0 }

Parent receives:
  { "type": "location_update",  "payload": { "lat": ..., "lng": ..., "ts": ... } }
  { "type": "route_deviation",  "payload": { "lat": ..., "lng": ..., "deviation_m": ... } }
"""

import json
import logging
from datetime import datetime, timezone
from typing import List, Tuple, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from ..ws.connection_manager import manager
from ..services.spatial import check_deviation
from ..services.sms_mock import dispatch_deviation_alert
from ..database import get_db

logger = logging.getLogger("ws.tracking")

router = APIRouter(tags=["websocket"])

# In-memory active route store: child_id → [(lat, lng), ...]
# In production, persist this in Redis or DB when child starts navigation.
active_routes: dict[str, List[Tuple[float, float]]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_child_contacts(child_id: str) -> List[Tuple[str, str]]:
    """Fetch emergency contacts for a child from DB."""
    async with await get_db() as db:
        cur = await db.execute(
            "SELECT name, phone FROM emergency_contacts WHERE child_id = ?",
            (child_id,)
        )
        rows = await cur.fetchall()
    return [(r["name"], r["phone"]) for r in rows]


async def _get_child_name(child_id: str) -> str:
    async with await get_db() as db:
        cur = await db.execute("SELECT name FROM users WHERE id = ?", (child_id,))
        row = await cur.fetchone()
    return row["name"] if row else "Unknown Child"


# ─────────────────────────────────────────────────────────────────────────────
# CHILD WebSocket — broadcasts live location
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/child/{child_id}")
async def child_tracking_ws(
    websocket:  WebSocket,
    child_id:   str,
    route_id:   Optional[str] = Query(default=None, description="Active route ID for deviation checking"),
):
    """
    The child app connects here and continuously sends GPS coordinates.
    The server:
      1. Persists each coordinate in gps_tracks.
      2. Forwards the location to all subscribed parent dashboards.
      3. Checks for off-route deviation and emits route_deviation alert.
    """
    await manager.connect_child(child_id, websocket)

    # Load active route for this child (set via /api/routes/set-active or stub)
    route = active_routes.get(child_id, [])

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
                continue

            if data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            lat = data.get("lat")
            lng = data.get("lng")
            accuracy_m = data.get("accuracy_m")

            if lat is None or lng is None:
                await websocket.send_text(json.dumps({"error": "lat and lng required"}))
                continue

            ts = _now_iso()

            # 1. Persist to DB
            async with await get_db() as db:
                await db.execute(
                    "INSERT INTO gps_tracks (child_id, lat, lng, accuracy_m) VALUES (?, ?, ?, ?)",
                    (child_id, lat, lng, accuracy_m)
                )
                await db.commit()

            # 2. Forward to parents
            location_msg = {
                "type": "location_update",
                "payload": {
                    "child_id":   child_id,
                    "lat":        lat,
                    "lng":        lng,
                    "accuracy_m": accuracy_m,
                    "ts":         ts,
                },
            }
            await manager.broadcast_to_parents(child_id, location_msg)

            # 3. Off-route deviation check
            if route:
                is_deviated, dist_m = check_deviation(lat, lng, route)
                if is_deviated:
                    logger.warning(
                        f"[DEVIATION] child={child_id} dist={dist_m:.1f}m (threshold=50m)"
                    )

                    deviation_msg = {
                        "type": "route_deviation",
                        "payload": {
                            "child_id":    child_id,
                            "lat":         lat,
                            "lng":         lng,
                            "deviation_m": dist_m,
                            "ts":          ts,
                        },
                    }
                    await manager.broadcast_to_parents(child_id, deviation_msg)

                    # Persist deviation alert
                    async with await get_db() as db:
                        await db.execute(
                            "INSERT INTO deviation_alerts (child_id, lat, lng, deviation_m) VALUES (?, ?, ?, ?)",
                            (child_id, lat, lng, dist_m)
                        )
                        await db.commit()

                    # SMS emergency contacts (fire-and-forget)
                    child_name = await _get_child_name(child_id)
                    contacts   = await _get_child_contacts(child_id)
                    if contacts:
                        import asyncio
                        asyncio.create_task(
                            dispatch_deviation_alert(child_name, lat, lng, dist_m, contacts)
                        )

    except WebSocketDisconnect:
        manager.disconnect_child(child_id)
        logger.info(f"[WS] Child {child_id} disconnected cleanly.")


# ─────────────────────────────────────────────────────────────────────────────
# PARENT WebSocket — subscribes to a child's live stream
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/parent/{child_id}")
async def parent_subscription_ws(websocket: WebSocket, child_id: str):
    """
    Parent dashboard connects here to subscribe to a specific child's
    live location stream and receive deviation/SOS events.
    """
    await manager.connect_parent(child_id, websocket)

    # Notify parent of subscription acknowledgment
    await websocket.send_text(json.dumps({
        "type": "parent_subscribed",
        "payload": {
            "child_id":         child_id,
            "child_online":     manager.is_child_online(child_id),
            "subscriber_count": manager.parent_subscriber_count(child_id),
        },
    }))

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw) if raw else {}
            if data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect_parent(child_id, websocket)
        logger.info(f"[WS] Parent unsubscribed from child {child_id}")


# ─────────────────────────────────────────────────────────────────────────────
# REST helper — set an active route for deviation checking
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import Body

@router.post("/api/routes/set-active", summary="Set the active route for deviation monitoring")
async def set_active_route(
    child_id: str = Body(...),
    coords:   List[List[float]] = Body(..., example=[[28.6139, 77.2090], [28.6145, 77.2100]]),
):
    """
    Store the child's planned route in memory for off-route deviation checking.
    coords: list of [lat, lng] pairs representing the route polyline.
    """
    route = [(c[0], c[1]) for c in coords if len(c) >= 2]
    active_routes[child_id] = route
    return {
        "child_id":    child_id,
        "waypoints":   len(route),
        "status":      "active_route_set",
    }
