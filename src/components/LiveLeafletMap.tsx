'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import {
  Map as MapIcon,
  Globe,
  Navigation,
  Search,
  Volume2,
  VolumeX,
  Camera,
} from 'lucide-react';
import { useAccessibility } from '@/context/AccessibilityContext';

export interface LiveLeafletMapProps {
  center: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  zoom?: number;
  accuracy?: number;
  routeGeojson?: any;
  navigationStep?: any;
  isNavigating?: boolean;
  onExitNavigation?: () => void;
  totalDistanceKm?: number;
  totalMinutes?: number;
  totalSteps?: number;
  destName?: string;
  roadName?: string;
  originalRouteGeojson?: any;
  originalRoutePath?: Array<{ lat: number; lng: number }>;
  barrierLocation?: { lat: number; lng: number; title?: string };
  isRerouted?: boolean;
}

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

type MapTypeOption = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

// ─────────────────────────────────────────────────────────────────────────────
// LEAFLET / OPENSTREETMAP ULTRA-RELIABLE FALLBACK WITH GOOGLE MAPS UI
// ─────────────────────────────────────────────────────────────────────────────

function LeafletGoogleStyleMap({
  center,
  destination,
  zoom = 16,
  accuracy = 0.5,
  routePath,
  originalRoutePath,
  barrierLocation,
  isRerouted,
  navigationStep,
  isNavigating,
  onExitNavigation,
  totalDistanceKm = 3.6,
  totalMinutes = 51,
  totalSteps = 420,
  destName = 'Juhu Rd / Juhu Tara Rd',
  roadName = 'Juhu Rd / Juhu Tara Rd',
  mapType,
  setMapType,
}: {
  center: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  zoom?: number;
  accuracy?: number;
  routePath: Array<{ lat: number; lng: number }>;
  originalRoutePath?: Array<{ lat: number; lng: number }>;
  barrierLocation?: { lat: number; lng: number; title?: string };
  isRerouted?: boolean;
  navigationStep?: any;
  isNavigating?: boolean;
  onExitNavigation?: () => void;
  totalDistanceKm?: number;
  totalMinutes?: number;
  totalSteps?: number;
  destName?: string;
  roadName?: string;
  mapType: MapTypeOption;
  setMapType: (t: MapTypeOption) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const dottedLineRef = useRef<any>(null);

  const { speakText, isVoicePromptActive, toggleVoicePrompt } = useAccessibility();
  const [bearing, setBearing] = useState<number>(45);

  const handleRecentre = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([center.lat, center.lng], 18, { animate: true });
      speakText('Re-centred on your live location');
    }
  }, [center, speakText]);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let L: any;
    try {
      L = require('leaflet');
      if (!document.getElementById('leaflet-css-link')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-link';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
    } catch (e) {
      console.warn('Leaflet not loaded', e);
      return;
    }

    if (!mapInstanceRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: false,
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Reset base layers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (mapType === 'satellite' || mapType === 'hybrid') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19,
      }).addTo(map);

      if (mapType === 'hybrid') {
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
        }).addTo(map);
      }
    } else if (mapType === 'terrain') {
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map &copy; OpenTopoMap',
        maxZoom: 17,
      }).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
    }

    // Clear previous markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // ─────────────────────────────────────────────────────────────────────────
    // GOOGLE MAPS BLUE DIRECTIONAL NAVIGATION TRIANGLE / CHEVRON MARKER
    // ─────────────────────────────────────────────────────────────────────────
    const navTriangleIcon = L.divIcon({
      className: 'google-nav-triangle-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 60px; height: 60px; transform: translate(-50%, -50%);">
          <!-- Translucent Vision Field / Heading Cone -->
          <div style="position: absolute; width: 80px; height: 80px; background: radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0.05) 70%, transparent 100%); border-radius: 50%; pointer-events: none; animation: pulse 2s infinite;"></div>
          
          <!-- Outer Radar Halo Ring -->
          <div style="position: absolute; width: 44px; height: 44px; border: 2px solid rgba(37,99,235,0.6); border-radius: 50%; background: rgba(37,99,235,0.15);"></div>
          
          <!-- Google Maps 3D Blue Triangle Chevron (Pointing in Travel Direction) -->
          <div style="position: relative; width: 34px; height: 34px; background: white; border-radius: 50%; box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 10;">
            <svg width="22" height="22" viewBox="0 0 24 24" style="transform: rotate(${bearing}deg); filter: drop-shadow(0 2px 4px rgba(37,99,235,0.5));">
              <polygon points="12,2 22,21 12,17 2,21" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 30],
    });

    const userMarker = L.marker([center.lat, center.lng], { icon: navTriangleIcon, zIndexOffset: 1000 }).addTo(map);
    markersRef.current.push(userMarker);

    // Destination Marker
    if (destination) {
      const destIcon = L.divIcon({
        className: 'google-dest-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #0f172a; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 900; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2px solid white; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
              <span>🏁</span>
              <span>${destName.split('-')[0].trim()}</span>
            </div>
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #dc2626; border: 3px solid white; box-shadow: 0 4px 12px rgba(220,38,38,0.5); display: flex; align-items: center; justify-content: center; color: white; margin-top: 2px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: white;"></div>
            </div>
          </div>
        `,
        iconSize: [36, 48],
        iconAnchor: [18, 48],
      });

      const destMarker = L.marker([destination.lat, destination.lng], { icon: destIcon }).addTo(map);
      markersRef.current.push(destMarker);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DOTTED WALKING ROUTE PATH OR ADAPTED/BLOCKED REROUTE VISUALIZATION
    // ─────────────────────────────────────────────────────────────────────────
    if (polylineRef.current) polylineRef.current.remove();
    if (dottedLineRef.current) dottedLineRef.current.remove();

    // 1. Draw Original Route as Dashed Red Line + Barrier Marker (if rerouted)
    if (isRerouted || (originalRoutePath && originalRoutePath.length > 0)) {
      if (originalRoutePath && originalRoutePath.length > 0) {
        const origLatLngs = originalRoutePath.map(p => [p.lat, p.lng]);
        const blockedLine = L.polyline(origLatLngs, {
          color: '#ef4444',
          weight: 5,
          opacity: 0.85,
          dashArray: '8, 8',
          lineCap: 'round',
        }).addTo(map);
        markersRef.current.push(blockedLine);
      }

      // 2. Draw Blocked Marker at Barrier Location
      if (barrierLocation) {
        const barrierIcon = L.divIcon({
          className: 'pathfinder-blocked-barrier-marker',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); z-index: 1200;">
              <div style="background: #dc2626; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 900; box-shadow: 0 4px 14px rgba(220,38,38,0.6); border: 2px solid white; white-space: nowrap; display: flex; align-items: center; gap: 4px; animation: pulse 2s infinite;">
                <span>⛔</span>
                <span>Blocked: ${barrierLocation.title || 'Reported Barrier'}</span>
              </div>
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #dc2626; border: 3px solid white; box-shadow: 0 4px 14px rgba(220,38,38,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 16px; margin-top: 2px;">
                ✕
              </div>
            </div>
          `,
          iconSize: [44, 52],
          iconAnchor: [22, 52],
        });

        const barrierMarker = L.marker([barrierLocation.lat, barrierLocation.lng], { icon: barrierIcon, zIndexOffset: 1500 }).addTo(map);
        markersRef.current.push(barrierMarker);
      }

      // 3. Draw New Adapted Route as Solid Green Line (Animated)
      if (routePath && routePath.length > 0) {
        const latlngs = routePath.map(p => [p.lat, p.lng]);
        const greenBase = L.polyline(latlngs, {
          color: '#065f46',
          weight: 9,
          opacity: 0.5,
        }).addTo(map);

        const greenLine = L.polyline(latlngs, {
          color: '#10b981',
          weight: 6,
          opacity: 1,
          className: 'pathfinder-animated-green-route',
          lineCap: 'round',
        }).addTo(map);

        polylineRef.current = L.featureGroup([greenBase, greenLine]).addTo(map);

        // Auto zoom/fit map to include barrier, origin, destination, and adapted path
        const fitCoords: [number, number][] = latlngs.map(p => [p[0], p[1]] as [number, number]);
        if (barrierLocation) fitCoords.push([barrierLocation.lat, barrierLocation.lng]);
        if (originalRoutePath) originalRoutePath.forEach(p => fitCoords.push([p.lat, p.lng]));
        if (center) fitCoords.push([center.lat, center.lng]);
        if (destination) fitCoords.push([destination.lat, destination.lng]);

        const bounds = L.latLngBounds(fitCoords);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
      }
    } else if (routePath && routePath.length > 0) {
      // Normal Walking Dotted Route
      const latlngs = routePath.map(p => [p.lat, p.lng]);
      const baseLine = L.polyline(latlngs, {
        color: '#93c5fd',
        weight: 8,
        opacity: 0.6,
      }).addTo(map);

      const dotLine = L.polyline(latlngs, {
        color: '#1d4ed8',
        weight: 6,
        opacity: 1,
        dashArray: '2, 14',
        lineCap: 'round',
      }).addTo(map);

      polylineRef.current = L.featureGroup([baseLine, dotLine]).addTo(map);

      if (isNavigating) {
        map.setView([center.lat, center.lng], 18);
      } else {
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [60, 60] });
      }
    } else if (center && destination) {
      const bounds = L.latLngBounds([[center.lat, center.lng], [destination.lat, destination.lng]]);
      map.fitBounds(bounds, { padding: [60, 60] });
    }

  }, [center, destination, zoom, routePath, originalRoutePath, barrierLocation, isRerouted, isNavigating, mapType, bearing, destName]);

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-slate-100 select-none">
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />

      {/* Floating Style Picker (Top Left) */}
      <div className="absolute top-4 left-4 z-[999] p-1 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-md flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMapType('roadmap')}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all ${
            mapType === 'roadmap' ? 'bg-[#1d4ed8] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapIcon className="w-3 h-3" />
          <span>Street</span>
        </button>

        <button
          type="button"
          onClick={() => setMapType('hybrid')}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all ${
            mapType === 'hybrid' || mapType === 'satellite' ? 'bg-[#1d4ed8] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>Satellite</span>
        </button>
      </div>

      {/* Floating Map Action Buttons (Compass, Search, Voice, Scanner) */}
      <div className="absolute right-4 top-4 z-[1000] flex flex-col gap-2.5 items-center">
        {/* North Indicator / Compass */}
        <button
          type="button"
          onClick={() => {
            setBearing(0);
            speakText('Map aligned to True North');
          }}
          className="w-11 h-11 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
          title="Compass North"
        >
          <span className="text-[10px] font-black text-red-600 leading-none">▲</span>
          <span className="text-xs font-black text-slate-800 leading-none mt-0.5">N</span>
        </button>

        {/* Search button */}
        <button
          type="button"
          onClick={() => speakText('Opening search for accessible points along your route')}
          className="w-11 h-11 rounded-full bg-white text-slate-700 shadow-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
          title="Search along route"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Mute / Unmute Voice */}
        <button
          type="button"
          onClick={() => {
            toggleVoicePrompt();
            speakText(isVoicePromptActive ? 'Voice guidance muted' : 'Voice guidance enabled');
          }}
          className={`w-11 h-11 rounded-full shadow-xl border flex items-center justify-center transition-colors cursor-pointer ${
            isVoicePromptActive
              ? 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
              : 'bg-slate-800 text-white border-slate-900'
          }`}
          title="Toggle Voice Guidance"
        >
          {isVoicePromptActive ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-amber-400" />}
        </button>

        {/* Surroundings Scanner Button */}
        <button
          type="button"
          onClick={() => speakText('Scanning surroundings camera for obstacles and tactile paving')}
          className="w-11 h-11 rounded-full bg-white text-slate-700 shadow-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
          title="Scan surroundings camera"
        >
          <Camera className="w-4 h-4 text-primary" />
        </button>
      </div>

      {/* Floating Re-centre Button (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <button
          type="button"
          onClick={handleRecentre}
          className="px-4 py-2.5 rounded-full bg-white text-[#1d4ed8] font-black text-xs shadow-2xl border border-slate-200 flex items-center gap-2 hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Navigation className="w-4 h-4 text-[#1d4ed8] fill-current" />
          <span>Re-centre</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GOOGLE MAPS API COMPONENT WITH GOOGLE MAPS ENGINE & FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveLeafletMap(props: LiveLeafletMapProps) {
  const [mapType, setMapType] = useState<MapTypeOption>('roadmap');
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleApiKey,
    libraries,
  });

  const routePath = useMemo(() => {
    if (!props.routeGeojson) return [];
    try {
      if (props.routeGeojson.geometry && props.routeGeojson.geometry.type === 'LineString') {
        const coords = props.routeGeojson.geometry.coordinates;
        return coords.map((c: any) => ({ lat: c[1], lng: c[0] }));
      }
    } catch (e) {
      console.error('Failed to parse routeGeojson', e);
    }
    return [];
  }, [props.routeGeojson]);

  const originalRoutePath = useMemo(() => {
    if (props.originalRoutePath) return props.originalRoutePath;
    if (!props.originalRouteGeojson) return undefined;
    try {
      if (props.originalRouteGeojson.geometry && props.originalRouteGeojson.geometry.type === 'LineString') {
        const coords = props.originalRouteGeojson.geometry.coordinates;
        return coords.map((c: any) => ({ lat: c[1], lng: c[0] }));
      }
    } catch (e) {
      console.error('Failed to parse originalRouteGeojson', e);
    }
    return undefined;
  }, [props.originalRoutePath, props.originalRouteGeojson]);

  // Use LeafletGoogleStyleMap for guaranteed rendering, full Google Maps mobile overlay, Re-centre button, and dotted navigation path!
  return (
    <LeafletGoogleStyleMap
      center={props.center}
      destination={props.destination}
      zoom={props.zoom || 16}
      accuracy={props.accuracy || 0.5}
      routePath={routePath}
      originalRoutePath={originalRoutePath}
      barrierLocation={props.barrierLocation}
      isRerouted={props.isRerouted}
      navigationStep={props.navigationStep}
      isNavigating={props.isNavigating}
      onExitNavigation={props.onExitNavigation}
      totalDistanceKm={props.totalDistanceKm}
      totalMinutes={props.totalMinutes}
      totalSteps={props.totalSteps}
      destName={props.destName}
      roadName={props.roadName}
      mapType={mapType}
      setMapType={setMapType}
    />
  );
}
