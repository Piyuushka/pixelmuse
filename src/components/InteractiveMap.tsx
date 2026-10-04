'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/context/AccessibilityContext';
import Last50mCard from './Last50mCard';
import { entrances } from '@/data/entrances';
import { selectEntrance } from '@/lib/entranceSelector';
import { useLocationPlannerState } from '@/hooks/useLocationPlannerState';
import LocationInputConnector from './ui/LocationInputConnector';
import Badge from './ui/Badge';
import {
  MapPin,
  Navigation,
  ZoomIn,
  ZoomOut,
  Layers,
  Crosshair,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Sliders,
  Building,
  Maximize2,
  Volume2,
  RotateCcw,
  Check
} from 'lucide-react';

interface InteractiveMapProps {
  initialSource?: string;
  initialDestination?: string;
  onSimulateClick?: () => void;
}

export default function InteractiveMap({
  initialSource = 'My Current Location (GPS High Precision)',
  initialDestination = 'Cardiology Pavilion - Level 3 (Building B)',
  onSimulateClick,
}: InteractiveMapProps) {
  const { persona, simulatedObstacle, speakText } = useAccessibility();
  const { source, destination, setSource, setDestination, swapLocations } = useLocationPlannerState({
    initialSource,
    initialDestination,
  });

  const [zoomLevel, setZoomLevel] = useState(16);
  const [activeLayer, setActiveLayer] = useState<'all' | 'tactile' | 'elevators' | 'ramps' | 'entrances'>('all');
  const [selectedWaypoint, setSelectedWaypoint] = useState<number | null>(null);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'accessibility'>('accessibility');

  const userLocationMock = { lat: 40.7126, lng: -74.0055 };
  const entranceSelection = selectEntrance(entrances, persona, userLocationMock);

  const waypoints = [
    {
      id: 1,
      x: '22%',
      y: '72%',
      title: 'South Ramp C Entrance',
      type: 'entrance',
      detail: 'Gentle 3.5% incline with dual stainless handrails. 110cm automatic door.',
      status: 'Verified Step-Free'
    },
    {
      id: 2,
      x: '45%',
      y: '55%',
      title: 'Elevator B Hub (West Wing)',
      type: 'elevator',
      detail: 'Accessible Braille buttons at 100cm height + voice floor announcer.',
      status: 'Active & Verified'
    },
    {
      id: 3,
      x: '75%',
      y: '32%',
      title: 'Cardiology Pavilion Suite 304',
      type: 'destination',
      detail: 'Wide 120cm double sliding doors with low-sensory waiting area.',
      status: 'Destination Reached'
    }
  ];

  return (
    <div className="relative w-full h-[calc(100vh-2rem)] rounded-3xl overflow-hidden border border-outline-variant/40 shadow-xl bg-surface-container-high flex flex-col lg:flex-row">

      {/* Floating Left Search & Route Control Panel (Google Maps Style) */}
      <div className="w-full lg:w-[420px] bg-surface-container-lowest/95 backdrop-blur-xl border-r border-outline-variant/30 p-5 flex flex-col gap-4 z-20 shadow-2xl overflow-y-auto max-h-full">

        {/* Source & Destination Routing Box */}
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <span className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 fill-primary" />
              GPS Route Engine
            </span>
            <Badge variant="secondary">
              WCAG AAA Active
            </Badge>
          </div>

          <LocationInputConnector
            source={source}
            destination={destination}
            onSourceChange={setSource}
            onDestinationChange={setDestination}
            onSwap={swapLocations}
          />

          {/* Persona Filter Strip */}
          <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant pt-1 border-t border-outline-variant/20">
            <span>Mode: <strong className="text-primary capitalize">{persona}</strong></span>
            <span className="text-secondary font-extrabold">100% Step-Free Guaranteed</span>
          </div>
        </div>

        {/* Live Reroute Banner if Obstacle is Active */}
        {simulatedObstacle.active && (
          <div className="p-3.5 rounded-2xl bg-tertiary-container/20 border border-tertiary/50 flex items-start gap-2.5 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-tertiary uppercase">Obstacle Reroute Active</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-tertiary text-white">
                  {simulatedObstacle.detourTime}
                </span>
              </div>
              <p className="text-xs font-bold text-on-surface mt-0.5">
                {simulatedObstacle.title}
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                Auto-redirected via Ramp C
              </p>
            </div>
          </div>
        )}

        {/* Route Summary Stats Card */}
        <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-around">
          <div className="text-center">
            <div className="text-[11px] font-bold text-on-surface-variant">Distance</div>
            <div className="text-lg font-black text-primary">450 m</div>
          </div>
          <div className="h-8 w-px bg-outline-variant/30" />
          <div className="text-center">
            <div className="text-[11px] font-bold text-on-surface-variant">Est. Time</div>
            <div className="text-lg font-black text-secondary">6 mins</div>
          </div>
          <div className="h-8 w-px bg-outline-variant/30" />
          <div className="text-center">
            <div className="text-[11px] font-bold text-on-surface-variant">Stairs</div>
            <div className="text-lg font-black text-secondary">0 (Zero)</div>
          </div>
        </div>

        <Last50mCard />

        {/* Selected Waypoint Info Detail Modal */}
        {selectedWaypoint !== null && (
          <div className="p-4 rounded-2xl bg-primary-container/10 border-2 border-primary flex flex-col gap-2 shadow-md animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-primary uppercase">
                Waypoint #{selectedWaypoint} Selected
              </span>
              <button
                onClick={() => setSelectedWaypoint(null)}
                className="text-xs font-bold text-on-surface-variant hover:text-on-surface"
              >
                ✕ Close
              </button>
            </div>
            <h4 className="text-sm font-extrabold text-on-surface">
              {waypoints.find(w => w.id === selectedWaypoint)?.title}
            </h4>
            <p className="text-xs text-on-surface-variant font-medium">
              {waypoints.find(w => w.id === selectedWaypoint)?.detail}
            </p>
          </div>
        )}

        {/* Action CTAs */}
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/micro-navigation"
            onClick={() => speakText("Launching turn by turn micro-navigation")}
            className="w-full h-13 rounded-2xl bg-primary text-on-primary font-black text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity"
          >
            <Navigation className="w-5 h-5 fill-current" />
            <span>Start Micro-Navigation Guidance</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (onSimulateClick) {
                onSimulateClick();
              } else {
                const el = document.getElementById('route-simulator-section');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  window.location.href = '/gps-precision#route-simulator-section';
                }
              }
            }}
            className="w-full h-11 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-xs text-on-surface flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Sliders className="w-4 h-4 text-primary" />
            <span>Simulate Urban Obstacles</span>
          </button>
        </div>

      </div>

      {/* Main Google Maps-Style Interactive Canvas */}
      <div className="flex-1 relative bg-[#e5eef9] overflow-hidden min-h-[400px]">

        {/* Vector Map Canvas Grid Background */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(#2563eb 1.5px, transparent 1.5px), radial-gradient(#059669 1.5px, #e5eef9 1.5px)`,
            backgroundSize: `${zoomLevel * 2}px ${zoomLevel * 2}px`,
            backgroundPosition: '0 0, 10px 10px'
          }}
        />

        {/* Simulated Road & Pedestrian Concourse Paths */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Main Road Concourse Vector */}
          <path
            d="M 100 450 Q 250 400 400 320 T 700 180 T 950 120"
            fill="none"
            stroke="#ffffff"
            strokeWidth="38"
            strokeLinecap="round"
          />
          <path
            d="M 100 450 Q 250 400 400 320 T 700 180 T 950 120"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="32"
            strokeLinecap="round"
          />

          {/* Active Step-Free Accessible Route Path Line */}
          <path
            d="M 120 440 Q 260 390 410 310 T 680 190 T 920 130"
            fill="none"
            stroke="#059669"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="8 6"
            className="animate-pulse"
          />

          {/* Tactile Paving Strip Overlay Line */}
          {(activeLayer === 'all' || activeLayer === 'tactile') && (
            <path
              d="M 120 440 Q 260 390 410 310"
              fill="none"
              stroke="#eab308"
              strokeWidth="4"
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {/* Building & Venue Cards Overlay on Map */}
        <div className="absolute top-8 right-24 bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-2xl border border-outline-variant/40 shadow-md flex items-center gap-2">
          <Building className="w-5 h-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs font-black text-on-surface">Cardiology Pavilion (Bldg B)</span>
            <span className="text-[10px] font-bold text-secondary">Step-Free Level 3 Direct Entrance</span>
          </div>
        </div>

        {/* Waypoint Markers on Canvas */}
        {waypoints.map((wp) => (
          <div
            key={wp.id}
            style={{ left: wp.x, top: wp.y }}
            onClick={() => {
              setSelectedWaypoint(wp.id);
              speakText(`Waypoint ${wp.id}: ${wp.title}`);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
          >
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full shadow-xl transition-transform group-hover:scale-125 ${wp.type === 'destination'
                ? 'bg-secondary text-white ring-4 ring-secondary/30'
                : 'bg-primary text-white ring-4 ring-primary/30'
              }`}>
              <MapPin className="w-6 h-6 fill-current" />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface-container-lowest text-on-surface text-[10px] font-black flex items-center justify-center border border-outline-variant shadow-xs">
                {wp.id}
              </span>
            </div>

            {/* Hover Tooltip */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-48 p-2.5 rounded-xl bg-on-surface text-white text-center text-xs font-bold shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
              {wp.title}
              <div className="text-[10px] font-medium text-secondary-container mt-0.5">{wp.status}</div>
            </div>
          </div>
        ))}

        {/* Entrance Markers on Canvas */}
        {(activeLayer === 'all' || activeLayer === 'entrances') && entrances.map((ent) => {
          // Mock coordinates for demo since map is an SVG illustration
          const coords: Record<string, { x: string, y: string }> = {
            'ent-1': { x: '40%', y: '40%' },
            'ent-2': { x: '25%', y: '65%' },
            'ent-3': { x: '55%', y: '50%' },
            'ent-4': { x: '65%', y: '45%' }
          };
          const pos = coords[ent.id] || { x: '50%', y: '50%' };

          let markerColor = 'bg-surface-container-highest text-on-surface ring-outline-variant/30';
          let markerStatus = 'Not Recommended';

          if (entranceSelection.recommended?.id === ent.id) {
            markerColor = 'bg-primary text-white ring-primary/30';
            markerStatus = 'Recommended';
          } else if (entranceSelection.avoided.some(a => a.entrance.id === ent.id)) {
            markerColor = 'bg-red-600 text-white ring-red-600/30';
            markerStatus = 'Avoided';
          }

          return (
            <div
              key={`entrance-${ent.id}`}
              style={{ left: pos.x, top: pos.y }}
              onClick={() => {
                speakText(`${markerStatus} Entrance: ${ent.name}`);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
            >
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-full shadow-md transition-transform group-hover:scale-125 ${markerColor} ring-4`}>
                <Building className="w-4 h-4 fill-current" />
              </div>

              {/* Hover Tooltip */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-40 p-2 rounded-xl bg-on-surface text-white text-center text-xs font-bold shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                {ent.name}
                <div className="text-[10px] font-medium mt-0.5" style={{ color: markerStatus === 'Recommended' ? '#a7f3d0' : markerStatus === 'Avoided' ? '#fecaca' : '#cbd5e1' }}>
                  {markerStatus}
                </div>
              </div>
            </div>
          );
        })}

        {/* Map Control Buttons (Top Right) */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">

          {/* Layer Selector */}
          <div className="bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl p-1 shadow-lg border border-outline-variant/30 flex flex-col gap-1">
            <button
              onClick={() => setActiveLayer('all')}
              className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeLayer === 'all' ? 'bg-primary text-white shadow-xs' : 'text-on-surface hover:bg-surface-container'
                }`}
              title="Show All Layers"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden md:inline">All Layers</span>
            </button>

            <button
              onClick={() => setActiveLayer('tactile')}
              className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeLayer === 'tactile' ? 'bg-secondary text-white shadow-xs' : 'text-on-surface hover:bg-surface-container'
                }`}
              title="Tactile Paving Strips"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden md:inline">Tactile Paving</span>
            </button>

            <button
              onClick={() => setActiveLayer('entrances')}
              className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeLayer === 'entrances' ? 'bg-primary text-white shadow-xs' : 'text-on-surface hover:bg-surface-container'
                }`}
              title="Accessible Entrances"
            >
              <Building className="w-4 h-4" />
              <span className="hidden md:inline">Entrances</span>
            </button>
          </div>

          {/* Zoom & Recenter Controls */}
          <div className="bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl p-1 shadow-lg border border-outline-variant/30 flex flex-col gap-1">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 2, 24))}
              className="p-2.5 hover:bg-surface-container rounded-xl text-on-surface font-extrabold focus:outline-none"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 2, 8))}
              className="p-2.5 hover:bg-surface-container rounded-xl text-on-surface font-extrabold focus:outline-none"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            <button
              onClick={() => speakText("Re-centered GPS location at South Concourse")}
              className="p-2.5 hover:bg-surface-container rounded-xl text-primary font-extrabold focus:outline-none"
              title="Center My GPS Location"
            >
              <Crosshair className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* Bottom Scale Indicator */}
        <div className="absolute bottom-4 right-4 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold text-on-surface border border-outline-variant/30 shadow-xs z-20">
          Scale: 1 : 500 • GPS Precision ±0.5m
        </div>

      </div>

    </div>
  );
}
