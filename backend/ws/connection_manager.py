"""
ws/connection_manager.py — WebSocket connection registry.

Tracks active WebSocket connections for:
  - Children broadcasting their GPS position
  - Parents subscribing to a specific child's position stream
"""

import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger("ws.manager")


class ConnectionManager:
    """
    Thread-safe registry for WebSocket connections.

    child_connections  : child_id → WebSocket  (one per child)
    parent_connections : child_id → {WebSocket} (many parents per child)
    """

    def __init__(self) -> None:
        self.child_connections:  Dict[str, WebSocket]      = {}
        self.parent_connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    # ── Child ──────────────────────────────────────────────────────────────

    async def connect_child(self, child_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.child_connections[child_id] = ws
        logger.info(f"[WS] Child connected: {child_id}")

    def disconnect_child(self, child_id: str) -> None:
        self.child_connections.pop(child_id, None)
        logger.info(f"[WS] Child disconnected: {child_id}")

    # ── Parent ─────────────────────────────────────────────────────────────

    async def connect_parent(self, child_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.parent_connections[child_id].add(ws)
        logger.info(f"[WS] Parent subscribed to child: {child_id}")

    def disconnect_parent(self, child_id: str, ws: WebSocket) -> None:
        self.parent_connections[child_id].discard(ws)
        logger.info(f"[WS] Parent unsubscribed from child: {child_id}")

    # ── Broadcast ──────────────────────────────────────────────────────────

    async def broadcast_to_parents(self, child_id: str, message: dict) -> None:
        """Send a JSON message to every parent subscribed to this child."""
        dead: Set[WebSocket] = set()
        payload = json.dumps(message)

        for ws in list(self.parent_connections.get(child_id, [])):
            try:
                await ws.send_text(payload)
            except Exception as exc:
                logger.warning(f"[WS] Dead parent socket removed ({exc})")
                dead.add(ws)

        self.parent_connections[child_id] -= dead

    async def send_to_child(self, child_id: str, message: dict) -> bool:
        """Send a JSON message to a specific child. Returns False if offline."""
        ws = self.child_connections.get(child_id)
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps(message))
            return True
        except Exception:
            self.disconnect_child(child_id)
            return False

    # ── Helpers ────────────────────────────────────────────────────────────

    def is_child_online(self, child_id: str) -> bool:
        return child_id in self.child_connections

    def parent_subscriber_count(self, child_id: str) -> int:
        return len(self.parent_connections.get(child_id, set()))


# Singleton shared across the app (imported by routers)
manager = ConnectionManager()
