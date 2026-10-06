"""
main.py — FastAPI application entry point.

Run:
    uvicorn backend.main:app --reload --port 8000

Swagger UI:   http://localhost:8000/docs
ReDoc:        http://localhost:8000/redoc
WebSocket test via test_client.py
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db, seed_demo_data
from .routers import pairing, sos, users
from .ws.tracking import router as tracking_router


# ─────────────────────────────────────────────────────────────────────────────
# LIFESPAN — startup / shutdown
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[startup] Initializing database…")
    await init_db()
    await seed_demo_data()
    print("[startup] Server ready ✓")
    yield
    print("[shutdown] Cleanup complete.")


# ─────────────────────────────────────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Pixel Muse — Parental Safety & Navigation Backend",
    description=(
        "Real-time GPS tracking via WebSockets, "
        "account pairing with 6-digit codes, "
        "SOS emergency dispatch, "
        "off-route deviation alerts, "
        "and emergency contact management."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend on port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(users.router)
app.include_router(pairing.router)
app.include_router(sos.router)
app.include_router(tracking_router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "Pixel Muse Backend"}


@app.get("/", tags=["meta"])
async def root():
    return {
        "message": "Pixel Muse — Parental Safety Backend",
        "docs":    "/docs",
        "redoc":   "/redoc",
    }
