"""
routers/users.py — User registration (lightweight, no auth).

POST /api/users      — create a parent or child user
GET  /api/users/{id} — get user profile
"""

import uuid
from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate):
    async with await get_db() as db:
        cur = await db.execute(
            "SELECT id FROM users WHERE email = ?", (body.email,)
        )
        if await cur.fetchone():
            raise HTTPException(409, detail="Email already registered")

        uid = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
            (uid, body.name, body.email, body.role.value)
        )
        await db.commit()

        cur = await db.execute("SELECT * FROM users WHERE id = ?", (uid,))
        row = await cur.fetchone()

    return UserOut(
        id=row["id"], name=row["name"], email=row["email"],
        role=row["role"], created_at=row["created_at"]
    )


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str):
    async with await get_db() as db:
        cur = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, detail="User not found")
    return UserOut(
        id=row["id"], name=row["name"], email=row["email"],
        role=row["role"], created_at=row["created_at"]
    )
