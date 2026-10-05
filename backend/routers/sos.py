"""
routers/sos.py — Emergency SOS trigger and contact management.

POST /api/sos/trigger                         — child triggers SOS
GET  /api/contacts/{child_id}                 — list emergency contacts
POST /api/contacts                            — add an emergency contact
DELETE /api/contacts/{contact_id}             — remove a contact
"""

import uuid
import json

from fastapi import APIRouter, HTTPException

from ..database import get_db
from ..models import (
    SOSTriggerRequest,
    SOSTriggerResponse,
    EmergencyContactCreate,
    EmergencyContactOut,
)
from ..services.sms_mock import dispatch_sos_to_contacts
from ..ws.connection_manager import manager

router = APIRouter(tags=["sos", "contacts"])


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/sos/trigger
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/sos/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(body: SOSTriggerRequest):
    """
    Triggered when the child presses the SOS/panic button.

    1. Resolves the latest GPS location (from request body or DB).
    2. Fetches all emergency contacts for the child.
    3. Dispatches SMS alerts concurrently (mock Twilio).
    4. Broadcasts a 'sos_triggered' WebSocket event to all parent dashboards.
    5. Persists the SOS event in the DB.
    """
    async with await get_db() as db:
        # Verify child exists
        cur = await db.execute(
            "SELECT id, name FROM users WHERE id = ? AND role = 'child'",
            (body.child_id,)
        )
        child = await cur.fetchone()
        if not child:
            raise HTTPException(404, detail="Child user not found")

        child_name = child["name"]

        # Resolve coordinates
        lat, lng = body.lat, body.lng
        if lat is None or lng is None:
            # Fallback to last known GPS track
            cur = await db.execute(
                "SELECT lat, lng FROM gps_tracks WHERE child_id = ? ORDER BY recorded_at DESC LIMIT 1",
                (body.child_id,)
            )
            track = await cur.fetchone()
            if not track:
                raise HTTPException(422, detail="No GPS location provided and no track history found")
            lat, lng = track["lat"], track["lng"]

        # Fetch emergency contacts
        cur = await db.execute(
            "SELECT name, phone FROM emergency_contacts WHERE child_id = ?",
            (body.child_id,)
        )
        rows       = await cur.fetchall()
        contacts   = [(r["name"], r["phone"]) for r in rows]

        if not contacts:
            raise HTTPException(422, detail="No emergency contacts configured for this child")

    # Dispatch SMS concurrently (outside DB transaction)
    alerted_phones, maps_link = await dispatch_sos_to_contacts(
        child_name, lat, lng, contacts
    )

    # Broadcast SOS event via WebSocket to parent dashboards
    sos_ws_event = {
        "type": "sos_triggered",
        "payload": {
            "child_id":  body.child_id,
            "child_name": child_name,
            "lat":        lat,
            "lng":        lng,
            "maps_link":  maps_link,
        },
    }
    await manager.broadcast_to_parents(body.child_id, sos_ws_event)

    # Persist SOS event to DB
    async with await get_db() as db:
        await db.execute(
            """INSERT INTO sos_events (child_id, lat, lng, contacts_alerted)
               VALUES (?, ?, ?, ?)""",
            (body.child_id, lat, lng, json.dumps(alerted_phones))
        )
        await db.commit()

    return SOSTriggerResponse(
        child_id=body.child_id,
        lat=lat,
        lng=lng,
        contacts_alerted=alerted_phones,
        maps_link=maps_link,
        message=f"SOS alert dispatched to {len(alerted_phones)} emergency contact(s).",
    )


# ─────────────────────────────────────────────────────────────────────────────
# EMERGENCY CONTACTS CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/contacts/{child_id}", response_model=list[EmergencyContactOut])
async def list_contacts(child_id: str):
    """List all emergency contacts for a child."""
    async with await get_db() as db:
        cur = await db.execute(
            "SELECT * FROM emergency_contacts WHERE child_id = ? ORDER BY created_at",
            (child_id,)
        )
        rows = await cur.fetchall()
    return [
        EmergencyContactOut(
            id=r["id"], child_id=r["child_id"], name=r["name"],
            phone=r["phone"], relation=r["relation"], created_at=r["created_at"]
        )
        for r in rows
    ]


@router.post("/api/contacts", response_model=EmergencyContactOut, status_code=201)
async def create_contact(body: EmergencyContactCreate):
    """Add an emergency contact for a child."""
    async with await get_db() as db:
        # Verify child
        cur = await db.execute(
            "SELECT id FROM users WHERE id = ? AND role = 'child'", (body.child_id,)
        )
        if not await cur.fetchone():
            raise HTTPException(404, detail="Child user not found")

        contact_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO emergency_contacts (id, child_id, name, phone, relation) VALUES (?, ?, ?, ?, ?)",
            (contact_id, body.child_id, body.name, body.phone, body.relation)
        )
        await db.commit()

        cur = await db.execute(
            "SELECT * FROM emergency_contacts WHERE id = ?", (contact_id,)
        )
        row = await cur.fetchone()

    return EmergencyContactOut(
        id=row["id"], child_id=row["child_id"], name=row["name"],
        phone=row["phone"], relation=row["relation"], created_at=row["created_at"]
    )


@router.delete("/api/contacts/{contact_id}", status_code=204)
async def delete_contact(contact_id: str):
    """Remove an emergency contact."""
    async with await get_db() as db:
        res = await db.execute(
            "DELETE FROM emergency_contacts WHERE id = ?", (contact_id,)
        )
        await db.commit()
        if res.rowcount == 0:
            raise HTTPException(404, detail="Contact not found")
