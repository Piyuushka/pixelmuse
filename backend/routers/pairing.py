"""
routers/pairing.py — Account pairing REST endpoints.

POST /api/pairing/generate   — parent generates a 6-digit code
POST /api/pairing/claim      — child claims the code to link accounts
GET  /api/pairing/{child_id} — get current pairing status for a child
POST /api/pairing/unlink     — unlink parent ↔ child
"""

import uuid
import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..database import get_db
from ..models import (
    GeneratePairingCodeRequest,
    GeneratePairingCodeResponse,
    ClaimPairingCodeRequest,
    PairingOut,
)

router = APIRouter(prefix="/api/pairing", tags=["pairing"])


def _generate_code() -> str:
    """Generate a human-readable code in the format PL-XXXXXX."""
    suffix = "".join(random.choices(string.digits, k=6))
    return f"PL-{suffix}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/pairing/generate
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GeneratePairingCodeResponse)
async def generate_pairing_code(body: GeneratePairingCodeRequest):
    """
    Parent requests a new temporary pairing code.
    If an active un-claimed code already exists for this parent, return it.
    Otherwise generate a fresh one.
    """
    async with await get_db() as db:
        # Check parent exists
        cur = await db.execute(
            "SELECT id, role FROM users WHERE id = ?", (body.parent_id,)
        )
        user = await cur.fetchone()
        if not user:
            raise HTTPException(404, detail="Parent user not found")
        if user["role"] != "parent":
            raise HTTPException(400, detail="Only users with role='parent' can generate pairing codes")

        # Reuse existing un-claimed active code
        cur = await db.execute(
            """SELECT id, pairing_code FROM pairings
               WHERE parent_id = ? AND child_id IS NULL AND is_active = 1
               ORDER BY created_at DESC LIMIT 1""",
            (body.parent_id,)
        )
        existing = await cur.fetchone()
        if existing:
            return GeneratePairingCodeResponse(
                pairing_id=existing["id"],
                pairing_code=existing["pairing_code"],
                message="Existing code returned — share with child app.",
            )

        # Generate a new unique code
        for _ in range(10):
            code = _generate_code()
            cur  = await db.execute(
                "SELECT id FROM pairings WHERE pairing_code = ?", (code,)
            )
            if not await cur.fetchone():
                break

        pairing_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO pairings (id, parent_id, pairing_code)
               VALUES (?, ?, ?)""",
            (pairing_id, body.parent_id, code)
        )
        await db.commit()

    return GeneratePairingCodeResponse(
        pairing_id=pairing_id,
        pairing_code=code,
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/pairing/claim
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/claim", response_model=PairingOut)
async def claim_pairing_code(body: ClaimPairingCodeRequest):
    """
    Child enters the pairing code to link their account with the parent.
    """
    async with await get_db() as db:
        # Validate child user
        cur = await db.execute(
            "SELECT id, role FROM users WHERE id = ?", (body.child_id,)
        )
        child = await cur.fetchone()
        if not child:
            raise HTTPException(404, detail="Child user not found")
        if child["role"] != "child":
            raise HTTPException(400, detail="Only users with role='child' can claim pairing codes")

        # Find the active un-claimed code
        cur = await db.execute(
            """SELECT id, parent_id, pairing_code FROM pairings
               WHERE pairing_code = ? AND child_id IS NULL AND is_active = 1""",
            (body.pairing_code,)
        )
        pairing = await cur.fetchone()
        if not pairing:
            raise HTTPException(404, detail="Pairing code not found or already used")

        # Link
        now = _now_iso()
        await db.execute(
            "UPDATE pairings SET child_id = ?, linked_at = ? WHERE id = ?",
            (body.child_id, now, pairing["id"])
        )
        await db.commit()

        # Fetch updated row
        cur = await db.execute("SELECT * FROM pairings WHERE id = ?", (pairing["id"],))
        row = await cur.fetchone()

    return PairingOut(
        id=row["id"],
        parent_id=row["parent_id"],
        child_id=row["child_id"],
        pairing_code=row["pairing_code"],
        is_active=bool(row["is_active"]),
        linked_at=row["linked_at"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/pairing/{child_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{child_id}", response_model=PairingOut)
async def get_pairing_status(child_id: str):
    """Return the active pairing record for a child."""
    async with await get_db() as db:
        cur = await db.execute(
            "SELECT * FROM pairings WHERE child_id = ? AND is_active = 1 LIMIT 1",
            (child_id,)
        )
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, detail="No active pairing found for this child")

    return PairingOut(
        id=row["id"],
        parent_id=row["parent_id"],
        child_id=row["child_id"],
        pairing_code=row["pairing_code"],
        is_active=bool(row["is_active"]),
        linked_at=row["linked_at"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/pairing/unlink
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/unlink")
async def unlink_accounts(child_id: str, parent_id: str):
    """Deactivate the pairing between a parent and child."""
    async with await get_db() as db:
        res = await db.execute(
            "UPDATE pairings SET is_active = 0 WHERE child_id = ? AND parent_id = ?",
            (child_id, parent_id)
        )
        await db.commit()
        if res.rowcount == 0:
            raise HTTPException(404, detail="No active pairing found")

    return {"status": "unlinked", "child_id": child_id, "parent_id": parent_id}
