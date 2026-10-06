"""
database.py — SQLite schema + async connection pool via aiosqlite.
All tables are created on first startup (CREATE TABLE IF NOT EXISTS).
"""

import aiosqlite
import asyncio
from pathlib import Path

DB_PATH = Path(__file__).parent / "pixelmuse.db"


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMA DDL
# ─────────────────────────────────────────────────────────────────────────────

SCHEMA_SQL = """
-- Users (parent or child role)
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,          -- UUID
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('parent', 'child')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pairing: links a child to a parent via a 6-digit code
CREATE TABLE IF NOT EXISTS pairings (
    id              TEXT PRIMARY KEY,
    parent_id       TEXT NOT NULL REFERENCES users(id),
    child_id        TEXT,                  -- NULL until child claims code
    pairing_code    TEXT UNIQUE NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,  -- 1 = linked, 0 = unlinked
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    linked_at       TEXT                   -- set when child claims
);

-- Emergency contacts stored per child profile
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id          TEXT PRIMARY KEY,
    child_id    TEXT NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    relation    TEXT NOT NULL DEFAULT 'Guardian',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Live GPS location snapshots (append-only log)
CREATE TABLE IF NOT EXISTS gps_tracks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id    TEXT NOT NULL REFERENCES users(id),
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    accuracy_m  REAL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SOS dispatch events (audit log)
CREATE TABLE IF NOT EXISTS sos_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id        TEXT NOT NULL REFERENCES users(id),
    lat             REAL NOT NULL,
    lng             REAL NOT NULL,
    contacts_alerted TEXT NOT NULL,   -- JSON array of phone numbers
    triggered_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Route deviation alerts (audit log)
CREATE TABLE IF NOT EXISTS deviation_alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id        TEXT NOT NULL REFERENCES users(id),
    lat             REAL NOT NULL,
    lng             REAL NOT NULL,
    deviation_m     REAL NOT NULL,
    alerted_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


async def get_db() -> aiosqlite.Connection:
    """Open a connection with WAL mode + row_factory for dict-like rows."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db() -> None:
    """Create tables on first run."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA_SQL)
        await db.commit()
    print(f"[DB] Initialized at {DB_PATH}")


async def seed_demo_data() -> None:
    """Insert demo parent + child + pairing code if not already present."""
    async with await get_db() as db:
        # Check if demo data exists
        cur = await db.execute("SELECT id FROM users WHERE email = 'parent@demo.com'")
        row = await cur.fetchone()
        if row:
            return  # already seeded

        import uuid
        parent_id = str(uuid.uuid4())
        child_id  = str(uuid.uuid4())

        await db.executemany(
            "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
            [
                (parent_id, "Demo Parent",  "parent@demo.com", "parent"),
                (child_id,  "Demo Child",   "child@demo.com",  "child"),
            ]
        )

        pairing_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO pairings (id, parent_id, child_id, pairing_code, is_active, linked_at)
               VALUES (?, ?, ?, ?, 1, datetime('now'))""",
            (pairing_id, parent_id, child_id, "PL-884920")
        )

        # Emergency contacts for demo child
        for i, (name, phone, rel) in enumerate([
            ("Demo Parent",  "+91-9876543210", "Parent"),
            ("Demo Guardian","+91-9123456789", "Guardian"),
        ]):
            await db.execute(
                "INSERT INTO emergency_contacts (id, child_id, name, phone, relation) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), child_id, name, phone, rel)
            )

        await db.commit()
        print(f"[DB] Demo data seeded — parent_id={parent_id} child_id={child_id}")
