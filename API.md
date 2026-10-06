# PathFinder Caregiver Safety Module — API Documentation

This document describes all API endpoints implemented for the PathFinder Caregiver Safety Module.

---

## 🔒 Base Principles
- **Error Format**: All endpoints return standard JSON error envelopes:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable error message",
      "details": []
    }
  }
  ```
- **Authentication**: JWT HTTP-only cookie (`pf_session`) with `userId`, `email`, and `role` (`USER` | `CAREGIVER`).
- **Data Types**: All timestamps are in UTC (`timestamptz` ISO 8601 string). All identifiers are UUIDs or prefixed IDs.

---

## 1. Authentication & Profile

### `POST /api/auth/signup`
Creates an account with server-enforced role assignment.

**Request Body:**
```json
{
  "email": "dependent@example.com",
  "password": "password123",
  "fullName": "Alex Rivera",
  "role": "USER",
  "phone": "+919876543210",
  "language": "en"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": "usr_12345",
    "email": "dependent@example.com",
    "name": "Alex Rivera",
    "role": "USER",
    "isMinor": false,
    "onboardingComplete": false
  },
  "message": "Account created successfully."
}
```

---

### `GET /api/me`
Retrieves current authenticated profile and onboarding status.

**Response (200 OK):**
```json
{
  "profile": {
    "id": "usr_demo_user",
    "email": "demo.user@pathfinder.app",
    "name": "Demo User",
    "role": "USER",
    "pairingCode": "852-963",
    "hasCompletedProfile": true,
    "accessibilityPreferences": {
      "persona": "wheelchair",
      "requireStepFree": true
    }
  }
}
```

---

### `PATCH /api/me`
Updates profile and mobility preferences.

**Request Body:**
```json
{
  "fullName": "Alex R.",
  "onboardingComplete": true,
  "mobilityProfile": {
    "persona": "wheelchair",
    "requireStepFree": true,
    "maxSlopePercent": 5
  }
}
```

---

## 2. Pairing & Consent Engine

### `POST /api/pairing/code`
Generates a new 6-digit cryptographically random pairing code with a 10-minute TTL.

**Response (200 OK):**
```json
{
  "success": true,
  "code": "852-963",
  "expiresAt": "2026-10-06T07:15:00.000Z",
  "qrPayload": "pathfinder:pair:852-963",
  "ttlSeconds": 600
}
```

---

### `POST /api/pairing/claim`
Caregiver submits a 6-digit code to request pairing.

**Request Body:**
```json
{
  "code": "852-963"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "linkId": "gl_12345",
  "status": "PENDING",
  "dependent": {
    "name": "Demo User",
    "email": "demo.user@pathfinder.app"
  },
  "message": "Connection request sent. Awaiting dependent approval on their device."
}
```

---

### `POST /api/pairing/[linkId]/respond`
Dependent approves or rejects an incoming pairing request.

**Request Body:**
```json
{
  "action": "APPROVE"
}
```

---

### `POST /api/links/[linkId]/pause` and `POST /api/links/[linkId]/resume`
Temporarily pauses or resumes real-time location sharing.

---

### `POST /api/links/[linkId]/revoke`
Revokes connection. Caregiver loses location access immediately.

---

## 3. Real-Time Location & Telemetry

### `POST /api/location`
User sends live GPS pings or offline batch queues.

**Request Body (Single):**
```json
{
  "lat": 18.9322,
  "lng": 72.8264,
  "accuracy_m": 4.5,
  "speed": 1.4,
  "heading": 45.0,
  "battery_pct": 92,
  "recorded_at": "2026-10-06T07:05:00.000Z"
}
```

---

### `GET /api/dependents/[id]/history?from=&to=&limit=100`
Caregiver queries historical breadcrumbs for playback (max 24 hours).

---

## 4. Emergency SOS & Distress Fan-Out

### `POST /api/sos`
User holds panic button for 3 seconds.

**Request Body:**
```json
{
  "lat": 18.9398,
  "lng": 72.8355,
  "accuracy_m": 3.0,
  "battery_pct": 88,
  "is_test": true,
  "idempotency_key": "sos_key_999"
}
```

---

### `POST /api/sos/[id]/acknowledge` & `POST /api/sos/[id]/resolve`
Caregiver acknowledges emergency or resolves the incident.

---

### `GET /api/emergency-numbers`
Returns verified Indian emergency hotlines (112, 100, 108, 101, 1091, 1098, 14567).

---

### `GET /api/nearby-help?lat=18.93&lng=72.83&type=hospital`
Proxies Google Places API with 60-second caching for nearby police stations and hospitals.

---

## 5. Safety Controls & Compliance

### CRUD `/api/geofences`
Manage circular safe zone geofences.

### `POST /api/checkin`
User sends "I reached safely" notification.

### `GET /api/reports/weekly?dependentId=`
Returns 7-day accessibility and safety summary.

### `GET /api/privacy/export` & `DELETE /api/privacy/delete-account`
Full compliance with India's Digital Personal Data Protection (DPDP) Act, 2023.
