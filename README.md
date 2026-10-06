# PathFinder Access — Two-Phone Live Tracking & Guardian Safety Portal

PathFinder Access is an accessible, WCAG AAA compliant navigation dashboard with an isolated **Navigator User Portal** and a dedicated **Caregiver Guardian Portal** supporting real-time two-device live GPS tracking, 6-digit code pairing, and emergency SOS alarms.

---

## 📱 Two-Phone Live Demo Walkthrough

### 1. Prerequisites & Starting the Server
```bash
npm install
npm run dev
```
The application runs on `http://localhost:3000`.

To demo on two physical smartphones, expose your localhost using your local network IP (e.g., `http://192.168.1.X:3000`), or via [ngrok](https://ngrok.com) / [Cloudflare Tunnel](https://developers.cloudflare.com/pages/how-to/preview-with-cloudflare-tunnel/):
```bash
npx cloudflared tunnel --url http://localhost:3000
# or
npx ngrok http 3000
```

---

### 2. Step-by-Step Two-Phone Demo Steps

#### 📱 Phone A — Logged in as User (Dependent Navigator)
1. Open the URL and arrive at `/login`.
2. Tap **"I am a User (Dependent)"** or tap **"1-Click Demo User →"** (`demo.user@pathfinder.app` / `demo1234`).
3. You are redirected to `/user/map`:
   - High-precision GPS navigation with step-free wheelchair routing.
   - **Simulate Movement (Demo)**: Tap the floating button in the top right to start a simulated walk along Mumbai streets (Marine Drive ➔ CSMT).
   - Real-time GPS pings are broadcasted to the caregiver stream every 3 seconds.
4. Open the sidebar (accessible menu with **no parental control links**):
   - Navigate to `/user/share` to view your 6-digit pairing code (with TTL expiry) and QR code.
   - When a caregiver connects, a consent prompt appears directly on this page.
   - Navigate to `/user/sos` and hold the red panic button for 3 seconds to trigger a distress broadcast.

#### 📱 Phone B — Logged in as Parent / Caregiver
1. Open the URL in an incognito window or on Phone B.
2. Tap **"I am a Parent / Caregiver"** or tap **"1-Click Demo Caregiver →"** (`demo.caregiver@pathfinder.app` / `demo1234`).
3. You are redirected to `/caregiver/map`:
   - **Live Tracking Map**: Watch Phone A's marker move smoothly across the map with an accuracy ring and live breadcrumbs polyline trail.
   - Real-time telemetry badges show Phone A's device battery (e.g., 95%), movement speed (km/h), and online status.
   - Tap **"Following"** to lock the map view onto Phone A.
4. **SOS Emergency Siren & Alert**:
   - When Phone A triggers an SOS, a full-width high-priority red alert overlay pops up on Phone B.
   - Tap **"Acknowledge"** to notify Phone A that help is on the way, or **"Mark Resolved"** once safe.
5. **Manage Dependents** (`/caregiver/dependents`):
   - Tap **"Add Dependent by Code"** to pair with another phone using its 6-digit code.

---

## 🏗️ Portal Architecture & Route Separation

```
/                     → Redirects to /login
/login                → Two-Card Role Selector Landing Page

/user/*               → Isolated Navigator User Portal (UserSidebar + Accessibility Toolbar)
  /user/map           → High Precision GPS & Step-Free Route Planner
  /user/alerts        → Live Adaptation & Detour Alerts
  /user/community     → Crowdsourced Hazard Reports & Upvotes
  /user/profile       → Mobility Persona & Assistive Preferences
  /user/share         → 6-Digit Pairing Code with TTL + Consent Manager
  /user/sos           → 3s Hold SOS Panic Button & Emergency Hotlines

/caregiver/*          → Isolated Caregiver Guardian Portal (CaregiverSidebar + SOS Handler)
  /caregiver/map      → Real-Time Dependent Tracking Map & Breadcrumb Trails
  /caregiver/dependents → Linked Dependents Management & Code Pairing
  /caregiver/alerts   → Safety Alerts & SOS Incident Log
  /caregiver/history  → Past Trips Telemetry Records
  /caregiver/settings → Geofence Safe Zones & Hardware Thresholds
```

---

## 🔒 Security & Middleware Guards
- Role-based route guards in `src/middleware.ts` prevent a `USER` session from accessing any `/caregiver/*` page and redirect a `CAREGIVER` away from `/user/*`.
- Pairing requires explicit consent verification between dependent and guardian.
