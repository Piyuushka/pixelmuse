"""
models.py — All Pydantic request/response schemas.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from enum import Enum


class UserRole(str, Enum):
    parent = "parent"
    child  = "child"


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name:  str
    email: EmailStr
    role:  UserRole


class UserOut(BaseModel):
    id:         str
    name:       str
    email:      str
    role:       UserRole
    created_at: str


# ── Pairing ───────────────────────────────────────────────────────────────────

class GeneratePairingCodeRequest(BaseModel):
    parent_id: str = Field(..., description="UUID of the parent user")


class GeneratePairingCodeResponse(BaseModel):
    pairing_id:   str
    pairing_code: str
    message:      str = "Share this code with the child application."


class ClaimPairingCodeRequest(BaseModel):
    child_id:     str = Field(..., description="UUID of the child user claiming the code")
    pairing_code: str = Field(..., min_length=6, max_length=9)


class PairingOut(BaseModel):
    id:           str
    parent_id:    str
    child_id:     Optional[str]
    pairing_code: str
    is_active:    bool
    linked_at:    Optional[str]


# ── Emergency Contacts ────────────────────────────────────────────────────────

class EmergencyContactCreate(BaseModel):
    child_id:  str
    name:      str
    phone:     str
    relation:  str = "Guardian"


class EmergencyContactOut(BaseModel):
    id:         str
    child_id:   str
    name:       str
    phone:      str
    relation:   str
    created_at: str


# ── GPS / Location ────────────────────────────────────────────────────────────

class GPSCoord(BaseModel):
    lat:        float = Field(..., ge=-90,  le=90)
    lng:        float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = None


class ChildLocationUpdate(BaseModel):
    child_id: str
    coord:    GPSCoord


# ── SOS ───────────────────────────────────────────────────────────────────────

class SOSTriggerRequest(BaseModel):
    child_id: str = Field(..., description="UUID of the child who triggered SOS")
    lat:      Optional[float] = None  # if None, use last known GPS track
    lng:      Optional[float] = None


class SOSTriggerResponse(BaseModel):
    child_id:         str
    lat:              float
    lng:              float
    contacts_alerted: List[str]
    maps_link:        str
    message:          str


# ── WebSocket events ──────────────────────────────────────────────────────────

class WSMessageType(str, Enum):
    location_update  = "location_update"
    route_deviation  = "route_deviation"
    sos_triggered    = "sos_triggered"
    parent_subscribed = "parent_subscribed"
    ping             = "ping"
    pong             = "pong"


class WSMessage(BaseModel):
    type:    WSMessageType
    payload: dict
