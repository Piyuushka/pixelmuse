# PathFinder Access (PixelMuse) - Architecture & Project Overview

This document serves as a complete technical reference and architectural overview of the **PathFinder Access (PixelMuse)** project. It is designed to give any AI model or developer a complete understanding of the codebase, feature set, technical stack, and overall goals of the project.

## 1. Project Overview & Core Vision
**PathFinder Access** is a WCAG AAA compliant, barrier-free navigation dashboard built for accessible urban exploration, wheelchair navigation, micro-navigation, live rerouting, and crowdsourced hazard reporting.

The core problem this project solves is the lack of accessibility-aware routing in traditional map applications. Standard navigation engines route for the fastest path, which might include stairs, unramped curbs, heavy flooding, or construction blockages. PathFinder Access dynamically calculates routes that are safe and accessible, primarily for specific personas (e.g., wheelchair users, older adults, low-vision individuals, and caregivers).

### Key Deliverables:
- **Dynamic Routing Engine**: Real-time route adaptation based on crowdsourced barrier data.
- **Micro-Navigation (Last 50 Meters)**: High-precision entrance discovery (e.g., tactile paths, wheelchair ramps, elevators).
- **Turn-by-Turn Voice Navigation**: Real-time auditory guidance for visually impaired users.
- **Cross-Platform Delivery**: Web-first (Next.js) wrapped natively for Android and iOS using Capacitor.
- **Community Trust System**: Crowdsourced reporting of barriers (flooding, barricades) with a confidence scoring mechanism.

---

## 2. Technical Stack

### Frontend & Core App
- **Framework**: Next.js 16.3.5 (App Router)
- **UI Library**: React 19.2.8
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, PostCSS
- **Icons**: `lucide-react`
- **Fonts**: Next.js Font Optimization (Inter, Atkinson Hyperlegible - specifically for low vision)

### Mapping & Spatial
- **Map Renderers**: 
  - `@react-google-maps/api` (Google Maps integration for core mapping, POIs, and Polylines)
  - `leaflet` & `react-leaflet` (Used for alternative Live Map components)
- **Routing Integrations**: 
  - OpenRouteService (via `src/lib/orsClient.ts`)
  - GraphHopper & OSRM configs generated dynamically for custom accessibility models.
- **GeoJSON Handling**: Extensive use of GeoJSON `LineString` for routing and `Point` for barriers.

### Mobile Native Wrapper (Capacitor)
The web app is bundled into native mobile applications using **Capacitor 8.x**.
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`
- **Native Plugins Used**:
  - `Geolocation`: High precision location tracking.
  - `Haptics`: Tactile feedback for navigation steps (useful for low vision).
  - `Keyboard`, `Network`, `Status Bar`, `Splash Screen`, `Push Notifications`.

### Backend & Database (Planned/Integrated)
- **Database Schema**: MongoDB (Mongoose) schema definitions (`src/lib/db/mongoSchema.ts`).
- **Geospatial Indexing**: MongoDB `2dsphere` index for `$geoNear` and `$geoWithin` queries.
- **Realtime Updates**: `barrierBroadcaster` pub/sub events for dynamic rerouting.

---

## 3. Core Architecture & Working Mechanisms

### A. Dynamic Barrier & Penalty Engine
**File**: `scripts/verify-routing-engine.ts`, `src/lib/routingEngine.ts`
- The system collects crowdsourced "Barrier Reports" (e.g., Heavy Flooding, Blocked Ramps, Construction).
- **Penalties**: 
  - A *Complete Blockage* assigns a traversal cost of `Infinity`.
  - *Heavy Flooding* adds a +500% (6x) traversal cost multiplier to the edge.
- **Dijkstra/A* Adaptation**: When a route is requested, the system maps the spatial bounding box of the barrier against graph edges (OSM Ways) and applies the penalties. The routing engine then recalculates to find the optimal accessible path.

### B. Route Recalculator & Active Sessions
**File**: `src/lib/navigationSessionRegistry.ts`, `src/lib/routeRecalculator.ts`
- Users begin a navigation session (tracked in `sessionRegistry`).
- When a new barrier's status is verified as `ACTIVE`, `triggerActiveBarrierRecalculation()` fires.
- The system checks active sessions whose spatial coordinates intersect the new barrier.
- It recalculates the route, emitting a `REROUTE_EMITTED` payload to the client, triggering a UI update and voice alert.

### C. The Unified Route Planner (Main UI)
**File**: `src/components/UnifiedRoutePlanner.tsx`
- **Dual Mode Location**: Users can use GPS (`useGeolocation` hook via Capacitor) or manual origin search.
- **Simulated GPS Accuracy**: The UI dynamically responds to GPS accuracy (e.g., ±0.5m High Precision vs ±35m Low Precision).
- **Persona Profiles**: Users select profiles:
  - `wheelchair` (avoids stairs, high slopes).
  - `older-adult` (prioritizes low slopes, rest stops).
  - `low-vision` (prioritizes tactile paving, auditory signals).
- **Navigation Flow**: Once a route is compared, the user starts Turn-by-Turn navigation. The UI overlays arrows, distances, and voice instructions using `window.speechSynthesis`.

### D. Last 50 Meters Micro-Navigation
**File**: `src/components/RealMap.tsx`
- Traditional routing stops at the building address. PathFinder Access includes specific entrance waypoints (e.g., "North Wing Wheelchair Ramp Entrance").
- The system renders specific tactile paths, ramps, and elevators on the Google Map overlay and provides highly localized voice context upon arrival.

### E. Community Confidence & Barrier Schema
**File**: `src/lib/db/mongoSchema.ts`
- **Fields**: `category`, `location` (GeoJSON Point), `confidence_score`, `routing_penalty`, `expires_at`.
- **TTL Map**: Different barriers auto-expire based on context (e.g., Flooding: 3 hrs, Police Barricade: 1 hr, Construction: 12 hrs).
- **Clustering**: Multiple reports in the same radius are clustered, increasing the `confidence_score` and `cluster_count`, which elevates a barrier from `PENDING` to `ACTIVE`.

---

## 4. Directory Structure Guide
- `src/app/`: Next.js App Router pages (e.g., `guardian-dashboard`, `safety-routing`, `report-barrier`).
- `src/components/`: Reusable React components (`LiveMapWrapper`, `InteractiveMap`, `UnifiedRoutePlanner`).
- `src/context/`: React Contexts, primarily `AccessibilityContext` handling Voice Synthesis and Persona state.
- `src/data/`: Mock data, Route Simulators, and Benchmark Scenarios for the demo.
- `src/lib/`: Core business logic (ORS client, Routing Engine algorithms, Spatial math, MongoDB schemas).
- `scripts/`: Standalone scripts for testing core logic (e.g., `verify-routing-engine.ts`).
- `android/` & `ios/`: Native Capacitor project folders.

## 5. How to Feed this to Another Model
When prompting another model to build features for this project, provide this document and emphasize:
1. **Accessibility First**: All new features must consider the `PersonaType` (wheelchair, low-vision, etc.).
2. **GeoJSON Driven**: Any spatial data generated or consumed must follow standard GeoJSON format (`Point`, `LineString`).
3. **Capacitor Compatibility**: Use native Capacitor plugins for hardware features instead of standard web APIs when possible.
4. **Tailwind Design System**: Maintain the semantic UI colors (`bg-surface`, `text-on-surface`, `bg-primary`, `text-on-primary-container`) configured in `tailwind.config` / `globals.css`.
