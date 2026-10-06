"""
services/sms_mock.py — Mock SMS / Twilio dispatch layer.

In production, replace _send_sms_via_twilio() with a real Twilio REST call.
The interface contract (function signatures, return types) stays identical.
"""

import asyncio
import logging
from typing import List, Tuple

logger = logging.getLogger("sms_mock")


# ─────────────────────────────────────────────────────────────────────────────
# MOCK TWILIO SENDER
# ─────────────────────────────────────────────────────────────────────────────

async def _send_sms_via_twilio(
    to_phone: str,
    body:     str,
) -> bool:
    """
    MOCK: Simulate SMS delivery with a 100 ms network delay.

    Production replacement:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        client.messages.create(to=to_phone, from_=TWILIO_FROM, body=body)
    """
    await asyncio.sleep(0.1)  # simulate network latency
    logger.info(f"[SMS MOCK] → {to_phone}: {body}")
    print(f"  📱 [SMS] Sent to {to_phone}: {body[:80]}...")
    return True


# ─────────────────────────────────────────────────────────────────────────────
# SOS DISPATCHER
# ─────────────────────────────────────────────────────────────────────────────

def _build_sos_message(
    child_name: str,
    lat:        float,
    lng:        float,
    maps_link:  str,
) -> str:
    return (
        f"🚨 EMERGENCY ALERT — {child_name} has triggered their SOS panic button!\n"
        f"Last known location: {lat:.6f}, {lng:.6f}\n"
        f"Open in Google Maps: {maps_link}\n"
        f"Please call or reach them immediately."
    )


async def dispatch_sos_to_contacts(
    child_name: str,
    child_lat:  float,
    child_lng:  float,
    contacts:   List[Tuple[str, str]],  # [(name, phone), ...]
) -> Tuple[List[str], str]:
    """
    Send SOS SMS to all emergency contacts concurrently.

    Returns:
        (alerted_phones, maps_link)
    """
    maps_link = (
        f"https://maps.google.com/?q={child_lat:.6f},{child_lng:.6f}"
    )
    message = _build_sos_message(child_name, child_lat, child_lng, maps_link)

    tasks = [
        _send_sms_via_twilio(phone, message)
        for _, phone in contacts
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    alerted_phones = [
        phone
        for (_, phone), ok in zip(contacts, results)
        if ok is True
    ]
    return alerted_phones, maps_link


# ─────────────────────────────────────────────────────────────────────────────
# DEVIATION ALERT SENDER
# ─────────────────────────────────────────────────────────────────────────────

async def dispatch_deviation_alert(
    child_name:  str,
    child_lat:   float,
    child_lng:   float,
    deviation_m: float,
    contacts:    List[Tuple[str, str]],
) -> None:
    """
    Send a route-deviation SMS to all emergency contacts (fire-and-forget).
    """
    maps_link = f"https://maps.google.com/?q={child_lat:.6f},{child_lng:.6f}"
    body = (
        f"⚠️ ROUTE DEVIATION — {child_name} has moved {deviation_m:.0f} m off their planned route.\n"
        f"Current location: {maps_link}\n"
        f"Please check in with them."
    )
    tasks = [_send_sms_via_twilio(phone, body) for _, phone in contacts]
    await asyncio.gather(*tasks, return_exceptions=True)
