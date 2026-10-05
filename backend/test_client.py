"""
test_client.py — Mock integration test script.

Simulates:
  1. Creating a parent + child user via REST.
  2. Generating + claiming a pairing code.
  3. Adding emergency contacts.
  4. Setting an active route for deviation checking.
  5. Connecting a "parent" WebSocket subscriber.
  6. Connecting a "child" WebSocket and walking along a route
     (first on-route, then purposely deviated to trigger a deviation alert).
  7. Triggering a test SOS event.

Run AFTER starting the server:
    uvicorn backend.main:app --reload --port 8000

Then in a separate terminal:
    python test_client.py
"""

import asyncio
import json
import random
import httpx
import websockets

BASE_HTTP = "http://localhost:8000"
BASE_WS   = "ws://localhost:8000"

# ─── Route: a straight path along Connaught Place, New Delhi ─────────────────
ON_ROUTE_WAYPOINTS = [
    (28.63290, 77.21940),
    (28.63310, 77.21960),
    (28.63330, 77.21980),
    (28.63350, 77.22000),
    (28.63370, 77.22020),
    (28.63390, 77.22040),
    (28.63410, 77.22060),
    (28.63430, 77.22080),
]

# Deviated position — ~120 m off the route (should trigger alert)
DEVIATED_POSITION = (28.63200, 77.22200)


# ─────────────────────────────────────────────────────────────────────────────
# 1. REST SETUP
# ─────────────────────────────────────────────────────────────────────────────

async def setup_rest() -> tuple[str, str]:
    """Create users, pair, add contacts. Returns (parent_id, child_id)."""
    async with httpx.AsyncClient(base_url=BASE_HTTP) as client:

        print("\n━━━ [1] Creating users ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        parent_res = await client.post("/api/users", json={
            "name": "Test Parent", "email": f"parent_{random.randint(1000,9999)}@test.com", "role": "parent"
        })
        parent_res.raise_for_status()
        parent = parent_res.json()
        parent_id = parent["id"]
        print(f"  ✅ Parent created: {parent_id} ({parent['email']})")

        child_res = await client.post("/api/users", json={
            "name": "Test Child",  "email": f"child_{random.randint(1000,9999)}@test.com",  "role": "child"
        })
        child_res.raise_for_status()
        child    = child_res.json()
        child_id = child["id"]
        print(f"  ✅ Child created:  {child_id} ({child['email']})")

        print("\n━━━ [2] Account Pairing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        code_res = await client.post("/api/pairing/generate", json={"parent_id": parent_id})
        code_res.raise_for_status()
        code_data    = code_res.json()
        pairing_code = code_data["pairing_code"]
        print(f"  🔑 Pairing code generated: {pairing_code}")

        claim_res = await client.post("/api/pairing/claim", json={
            "child_id": child_id, "pairing_code": pairing_code
        })
        claim_res.raise_for_status()
        print(f"  🔗 Child claimed code → linked successfully!")

        print("\n━━━ [3] Adding Emergency Contacts ━━━━━━━━━━━━━━━━━━━━━━━━")

        for name, phone, rel in [
            ("Emergency Mom",  "+91-9876543210", "Parent"),
            ("Emergency Dad",  "+91-9123456789", "Parent"),
            ("Family Doctor",  "+91-9001122334", "Doctor"),
        ]:
            r = await client.post("/api/contacts", json={
                "child_id": child_id, "name": name, "phone": phone, "relation": rel
            })
            r.raise_for_status()
            print(f"  📱 Contact added: {name} ({phone})")

        print("\n━━━ [4] Setting Active Route ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        route_res = await client.post("/api/routes/set-active", json={
            "child_id": child_id,
            "coords":   [[lat, lng] for lat, lng in ON_ROUTE_WAYPOINTS],
        })
        route_res.raise_for_status()
        print(f"  🗺️  Route set: {route_res.json()['waypoints']} waypoints")

    return parent_id, child_id


# ─────────────────────────────────────────────────────────────────────────────
# 2. PARENT WEBSOCKET — subscribe & listen
# ─────────────────────────────────────────────────────────────────────────────

async def parent_listener(child_id: str, stop_event: asyncio.Event) -> None:
    uri = f"{BASE_WS}/ws/parent/{child_id}"
    print(f"\n━━━ [5] Parent subscribed → {uri}")
    async with websockets.connect(uri) as ws:
        while not stop_event.is_set():
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                msg = json.loads(raw)
                t   = msg.get("type")
                p   = msg.get("payload", {})

                if t == "parent_subscribed":
                    print(f"  ✅ Parent subscribed — child online={p.get('child_online')}")
                elif t == "location_update":
                    print(f"  📍 Location → lat={p['lat']:.5f} lng={p['lng']:.5f}")
                elif t == "route_deviation":
                    print(f"  ⚠️  DEVIATION ALERT! Dist={p['deviation_m']} m — lat={p['lat']:.5f} lng={p['lng']:.5f}")
                elif t == "sos_triggered":
                    print(f"  🚨 SOS EVENT! Child={p.get('child_name')} → {p.get('maps_link')}")
                elif t == "pong":
                    pass
                else:
                    print(f"  [WS] Unknown event: {msg}")
            except asyncio.TimeoutError:
                continue


# ─────────────────────────────────────────────────────────────────────────────
# 3. CHILD WEBSOCKET — walk the route, then deviate
# ─────────────────────────────────────────────────────────────────────────────

async def child_walker(child_id: str, stop_event: asyncio.Event) -> None:
    uri = f"{BASE_WS}/ws/child/{child_id}"
    print(f"\n━━━ [6] Child walking route → {uri}")
    async with websockets.connect(uri) as ws:

        # Step 1: Walk along route (on-route)
        print("  🚶 Walking on-route waypoints…")
        for i, (lat, lng) in enumerate(ON_ROUTE_WAYPOINTS):
            payload = json.dumps({"lat": lat, "lng": lng, "accuracy_m": 5.0})
            await ws.send(payload)
            print(f"     Waypoint {i+1}/{len(ON_ROUTE_WAYPOINTS)}: ({lat:.5f}, {lng:.5f})")
            await asyncio.sleep(0.5)

        # Step 2: Deviate OFF route (should trigger alert)
        print("\n  🏃 Deviating off-route…")
        for _ in range(3):
            lat, lng = DEVIATED_POSITION
            lat += random.uniform(-0.0001, 0.0001)
            lng += random.uniform(-0.0001, 0.0001)
            payload = json.dumps({"lat": lat, "lng": lng, "accuracy_m": 5.0})
            await ws.send(payload)
            print(f"     Deviated position: ({lat:.5f}, {lng:.5f})")
            await asyncio.sleep(0.5)

        # Step 3: Ping
        await ws.send(json.dumps({"type": "ping"}))
        await asyncio.sleep(0.3)

    stop_event.set()


# ─────────────────────────────────────────────────────────────────────────────
# 4. SOS TEST
# ─────────────────────────────────────────────────────────────────────────────

async def test_sos(child_id: str) -> None:
    print("\n━━━ [7] Triggering SOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    lat, lng = DEVIATED_POSITION
    async with httpx.AsyncClient(base_url=BASE_HTTP) as client:
        res = await client.post("/api/sos/trigger", json={
            "child_id": child_id, "lat": lat, "lng": lng
        })
        if res.status_code == 200:
            data = res.json()
            print(f"  🚨 SOS dispatched! Alerted: {data['contacts_alerted']}")
            print(f"  🗺️  Maps link: {data['maps_link']}")
        else:
            print(f"  ❌ SOS failed: {res.status_code} {res.text}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("  Pixel Muse — Parental Safety Integration Test")
    print("=" * 60)

    # REST setup
    parent_id, child_id = await setup_rest()

    stop_event = asyncio.Event()

    # Small delay to let parent subscribe before child starts walking
    await asyncio.sleep(0.5)

    # Run parent listener + child walker concurrently
    await asyncio.gather(
        parent_listener(child_id, stop_event),
        child_walker(child_id, stop_event),
    )

    # Trigger SOS after walk completes
    await asyncio.sleep(0.5)
    await test_sos(child_id)

    print("\n✅ Test complete. Check logs above for location, deviation, and SOS events.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
