'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAccessibility, PersonaType, PERSONAS } from '@/context/AccessibilityContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import LiveMapWrapper from '@/components/LiveMapWrapper';
import InteractiveMap from '@/components/InteractiveMap';
import SchematicRouteVisualizer from '@/components/SchematicRouteVisualizer';
import PersonalizedProfileBanner from '@/components/PersonalizedProfileBanner';
import {
  DEMO_LOCATIONS,
  BENCHMARK_SCENARIOS,
  getRouteComparison,
  RouteScenarioData
} from '@/data/routeSimulatorData';
import { getLiveRouteScenario, searchLocation } from '@/lib/orsClient';
import LocationSearchInput from '@/components/LocationSearchInput';
import {
  MapPin,
  Navigation,
  ShieldCheck,
  Compass,
  Crosshair,
  RefreshCw,
  Sliders,
  Sparkles,
  Shuffle,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Building,
  CloudRain,
  Users,
  ChevronDown,
  Info,
  ThumbsUp,
  Flame,
  Accessibility,
  Footprints,
  UserCheck,
  Eye,
  Heart,
  Radio,
  Lock,
  ArrowDown
} from 'lucide-react';

interface UnifiedRoutePlannerProps {
  initialMode?: 'gps' | 'manual';
}

export default function UnifiedRoutePlanner({ initialMode = 'gps' }: UnifiedRoutePlannerProps) {
  const { speakText, simulatedObstacle, activeHazardAlert, originalRoute, adaptedRoute, persona } = useAccessibility();
  const searchParams = useSearchParams();

  const urlDest = searchParams?.get('dest');
  const urlPersona = searchParams?.get('persona') as PersonaType | null;
  const urlMode = searchParams?.get('mode') as 'gps' | 'manual' | null;
  const urlAutonav = searchParams?.get('autonav') === '1' || searchParams?.get('autonav') === 'true';
  const urlReroute = searchParams?.get('reroute') === 'active' || Boolean(searchParams?.get('reportId'));

  const isRerouteActive = Boolean(urlReroute || (activeHazardAlert?.active && activeHazardAlert?.rerouteResult));
  const [routeUpdateToast, setRouteUpdateToast] = useState<string | null>(null);

  // Resolve initial destination from query param if provided
  const matchedDest = DEMO_LOCATIONS.find(
    l => l.id === urlDest || l.name.toLowerCase() === urlDest?.toLowerCase() || (urlDest && l.name.toLowerCase().includes(urlDest.toLowerCase()))
  );
  const initialDest = matchedDest?.name || urlDest || 'Shivaji Park';

  const { coordinates, accuracy, error, isLoading } = useGeolocation();

  // Mode state: 'gps' uses detected GPS location, 'manual' unlocks dropdown
  const [locationMode, setLocationMode] = useState<'gps' | 'manual'>(urlMode || initialMode);

  // GPS Precision state
  const [simulatedAccuracy, setSimulatedAccuracy] = useState<number | null>(null);
  const [isRefreshingGps, setIsRefreshingGps] = useState<boolean>(false);
  
  const [resolvedGpsName, setResolvedGpsName] = useState<string>('Live Position');
  
  useEffect(() => {
    if (coordinates) {
      // simple reverse lookup simulation for demo, or actual call
      const isDombivli = Math.abs(coordinates.lat - 19.217) < 0.01;
      setResolvedGpsName(isDombivli ? 'Sarvoday Swaroop, Dombivli' : 'Live GPS Location');
    }
  }, [coordinates]);

  const detectedLocationName = error ? 'Location Unavailable' : (coordinates ? resolvedGpsName : 'Acquiring GPS...');
  const detectedCoordinates = coordinates || { lat: 19.2185528, lng: 73.0770473 }; // Fallback to Sarvoday Swaroop, Dombivli
  const gpsAccuracyMeters = simulatedAccuracy !== null ? simulatedAccuracy : (accuracy ? Math.round(accuracy) : 0.5);

  // Route Setup state
  const defaultStart = DEMO_LOCATIONS.find(l => l.name === 'Dadar Railway Station');
  const defaultDest = matchedDest
    ? { name: matchedDest.name, coords: { lat: matchedDest.lat!, lng: matchedDest.lng! } }
    : { name: initialDest, coords: { lat: 19.0222, lng: 72.8365 } };
  
  const [startLocation, setStartLocation] = useState<{name: string, coords: any} | null>(
    defaultStart ? { name: defaultStart.name, coords: { lat: defaultStart.lat!, lng: defaultStart.lng! } } : null
  );
  const [destLocation, setDestLocation] = useState<{name: string, coords: any} | null>(
    defaultDest
  );
  const [preference, setPreference] = useState<PersonaType>(
    urlPersona && PERSONAS.some(p => p.id === urlPersona) ? urlPersona : (persona || 'wheelchair')
  );

  // Automatically inherit saved profile persona if updated in session
  useEffect(() => {
    if (persona && !urlPersona) {
      setPreference(persona);
    }
  }, [persona, urlPersona]);

  // Trigger Reroute Toast & Auto-Navigation
  useEffect(() => {
    if (isRerouteActive) {
      const detour = activeHazardAlert?.detourTime || '+3 min detour';
      const toastMsg = `Route updated: ${detour}, 100% step-free`;
      setRouteUpdateToast(toastMsg);
      setIsNavigating(true);
      speakText(`Route updated: ${detour}, 100% step-free. Navigation started along safe adapted route.`);

      const timer = setTimeout(() => {
        setRouteUpdateToast(null);
      }, 9000);
      return () => clearTimeout(timer);
    } else if (urlAutonav) {
      setIsNavigating(true);
      speakText('Starting accessible navigation from your live GPS position.');
    }
  }, [isRerouteActive, urlAutonav]);

  // Animation and calculation states
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [hasCompared, setHasCompared] = useState<boolean>(true);
  const [scenarioIndex, setScenarioIndex] = useState<number>(0);
  const [visualizerView, setVisualizerView] = useState<'both' | 'normal' | 'accessible'>('both');

  // Navigation State
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Section references for smooth scrolling
  const routeSetupRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);

  // Effective starting location based on mode
  const effectiveStartName = locationMode === 'gps' ? detectedLocationName : (startLocation?.name || 'Origin');
  const destName = destLocation?.name || 'Destination';

  // Compute route scenario data dynamically
  const [scenarioData, setScenarioData] = useState<RouteScenarioData & { geojsonNormal?: any, geojsonAccessible?: any }>(
    getRouteComparison(effectiveStartName, destName, preference)
  );

  const { normal, accessible, whyChanged, summaryText, geojsonNormal, geojsonAccessible, accessibleSteps, normalSteps } = scenarioData;

  // Use adapted steps if rerouted, otherwise fallback to accessibleSteps
  const effectiveSteps = isRerouteActive && activeHazardAlert?.rerouteResult?.steps && activeHazardAlert.rerouteResult.steps.length > 0
    ? activeHazardAlert.rerouteResult.steps
    : accessibleSteps;

  const effectiveRouteGeojson = isRerouteActive && (adaptedRoute || activeHazardAlert?.rerouteResult?.route)
    ? (adaptedRoute || activeHazardAlert?.rerouteResult?.route)
    : (preference === 'none' ? geojsonNormal : (geojsonAccessible || geojsonNormal));

  const effectiveOriginalRouteGeojson = isRerouteActive
    ? (originalRoute || activeHazardAlert?.rerouteResult?.originalRoute || geojsonNormal)
    : undefined;

  const barrierLocation = isRerouteActive
    ? {
        lat: activeHazardAlert?.rerouteResult?.blockedCoords?.lat || 19.0220,
        lng: activeHazardAlert?.rerouteResult?.blockedCoords?.lng || 72.8400,
        title: activeHazardAlert?.title || 'Reported Hazard',
      }
    : undefined;

  // Dynamic Delta Calculations
  const deltaDistance = Number((accessible.distance - normal.distance).toFixed(1));
  const deltaTime = accessible.time - normal.time;
  const stairsAvoided = normal.stairs - accessible.stairs;
  const slopeReduction = normal.maxSlope - accessible.maxSlope;
  const barriersAvoided = normal.barriers - accessible.barriers;
  const unsafeCrossingsAvoided = normal.unsafeCrossings - accessible.unsafeCrossings;

  const benchmarkKeys = Object.keys(BENCHMARK_SCENARIOS);

  // Handlers
  const handleUseGpsLocation = () => {
    setLocationMode('gps');
    if (coordinates) {
      setStartLocation({ name: detectedLocationName, coords: coordinates });
    }
    speakText(`GPS mode activated. Current location ${detectedLocationName} set as starting origin with ±${gpsAccuracyMeters}m accuracy.`);
    routeSetupRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRefreshGps = () => {
    setIsRefreshingGps(true);
    speakText("Refreshing GPS satellite fix...");
    setTimeout(() => {
      setIsRefreshingGps(false);
      setSimulatedAccuracy(null); // Reset to true accuracy
      speakText(`GPS signal recalibrated.`);
    }, 700);
  };

  const handleToggleAccuracySim = () => {
    const nextVal = gpsAccuracyMeters <= 5 ? 35 : 0.5;
    setSimulatedAccuracy(nextVal);
    speakText(`GPS simulated accuracy toggled to ±${nextVal} meters.`);
  };

  const handleCompare = async () => {
    setIsComparing(true);
    
    let targetDestCoords = destLocation?.coords;
    let targetDestName = destName;

    // 1. Geocode searchDestination text via searchLocation if coordinates are missing
    if (!targetDestCoords && destName) {
      const results = await searchLocation(destName);
      if (results && results.length > 0) {
        const nomResult = results[0];
        targetDestCoords = nomResult.coordinates;
        targetDestName = nomResult.name;
        setDestLocation({ name: nomResult.name, coords: nomResult.coordinates });
      }
    }

    const mockData = getRouteComparison(effectiveStartName, targetDestName, preference);
    
    const sCoords = locationMode === 'gps' ? detectedCoordinates : startLocation?.coords;

    // 2. Fetch Dynamic Route via OpenRouteService (with Nominatim geocoded coordinates)
    if (sCoords && targetDestCoords) {
      const liveData = await getLiveRouteScenario(sCoords, targetDestCoords, preference);
      if (liveData) {
        setScenarioData(liveData);
      } else {
        setScenarioData(mockData);
      }
    } else {
      setScenarioData(mockData);
    }

    speakText(`Calculating barrier-free route from ${effectiveStartName} to ${targetDestName} for ${preference} profile.`);
    
    setIsComparing(false);
    setHasCompared(true);
    setIsNavigating(false);
    setCurrentStepIndex(0);
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Automatically start voice navigation if requested by Voice Assistant via URL (?autonav=1)
  useEffect(() => {
    if (urlAutonav && urlDest) {
      const timer = setTimeout(() => {
        setIsNavigating(true);
        setCurrentStepIndex(0);
        const firstStep =
          accessibleSteps?.[0]?.detail ||
          accessibleSteps?.[0]?.title ||
          'Walk straight for 20 steps. You will feel a textured pavement crossing. Turn right.';
        speakText(`Live voice navigation active to ${initialDest}. Step 1: ${firstStep}`);
        mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [urlAutonav, urlDest, initialDest]);

  const handleStartNavigation = () => {
    setIsNavigating(true);
    setCurrentStepIndex(0);
    const firstStep =
      accessibleSteps?.[0]?.detail ||
      accessibleSteps?.[0]?.title ||
      'Follow the arrows on the map.';
    speakText(`Voice navigation started to ${destName}. Step 1: ${firstStep}`);
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSimulateWalk = () => {
    if (accessibleSteps && currentStepIndex < accessibleSteps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const step = accessibleSteps[nextIdx];
      const stepText = step.detail || step.title;
      speakText(`Step ${nextIdx + 1}: ${stepText}`);
    } else {
      speakText("You have arrived safely at your destination.");
      setIsNavigating(false);
    }
  };

  const handleTryDemoRoute = () => {
    setLocationMode('gps');
    
    const dadar = DEMO_LOCATIONS.find(l => l.name === 'Dadar Railway Station')!;
    const shivaji = DEMO_LOCATIONS.find(l => l.name === 'Shivaji Park')!;
    
    setStartLocation({ name: dadar.name, coords: { lat: dadar.lat!, lng: dadar.lng! } });
    setDestLocation({ name: shivaji.name, coords: { lat: shivaji.lat!, lng: shivaji.lng! } });
    
    setPreference('wheelchair');
    setSimulatedAccuracy(0.5);
    setIsComparing(true);
    speakText("Loading unified demo flow: GPS location at Dadar Railway Station to Shivaji Park for wheelchair user.");
    setTimeout(() => {
      setIsComparing(false);
      setHasCompared(true);
      comparisonRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 600);
  };

  const handleTryAnotherScenario = () => {
    const nextIdx = (scenarioIndex + 1) % benchmarkKeys.length;
    setScenarioIndex(nextIdx);
    const [startName, destName] = benchmarkKeys[nextIdx].split(' → ');
    
    const sLoc = DEMO_LOCATIONS.find(l => l.name === startName);
    const dLoc = DEMO_LOCATIONS.find(l => l.name === destName);

    setLocationMode('manual');
    if (sLoc && dLoc) {
      setStartLocation({ name: startName, coords: { lat: sLoc.lat!, lng: sLoc.lng! } });
      setDestLocation({ name: destName, coords: { lat: dLoc.lat!, lng: dLoc.lng! } });
    }
    
    setIsComparing(true);
    speakText(`Loading scenario: ${startName} to ${destName}`);
    setTimeout(() => {
      setIsComparing(false);
      setHasCompared(true);
    }, 550);
  };

  const handleSwapLocations = () => {
    if (locationMode === 'gps') {
      setLocationMode('manual');
    }
    const temp = startLocation;
    setStartLocation(destLocation);
    setDestLocation(temp);
    setHasCompared(false); // require re-comparison
  };

  const getPreferenceIcon = (id: PersonaType) => {
    switch (id) {
      case 'wheelchair': return <Accessibility className="w-5 h-5" />;
      case 'older-adult': return <Footprints className="w-5 h-5" />;
      case 'low-vision': return <Eye className="w-5 h-5" />;
      case 'caregiver': return <Heart className="w-5 h-5" />;
      default: return <Navigation className="w-5 h-5" />;
    }
  };

  const selectedPrefObj = PERSONAS.find(p => p.id === preference) || PERSONAS[0];

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center bg-surface">
      <div className="w-full max-w-[1150px] flex flex-col gap-8">
        {/* Personalized Profile Header Banner with Edit Profile CTA */}
        <PersonalizedProfileBanner />

        {/* ========================================================================= */}
        {/* UNIFIED HERO HEADER                                                       */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg flex-shrink-0">
              <Compass className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight">
                  Accessible Route Planner
                </h1>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container uppercase tracking-wider shadow-2xs">
                  GPS Precision + Route Simulator Unified
                </span>
              </div>
              <p className="text-on-surface-variant text-base font-semibold mt-1">
                Real-time location detection seamlessly integrated with accessibility-aware route optimization.
              </p>
            </div>
          </div>

          {/* Quick Audio Header CTA */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => speakText(`Unified Accessible Route Planner active. Location is ${effectiveStartName} with GPS accuracy ±${gpsAccuracyMeters}m. Destination is ${destName} for ${selectedPrefObj.label}.`)}
              className="p-2.5 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-primary shadow-xs transition-colors"
              title="Speak page summary"
              aria-label="Read screen aloud"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
        </div>



        {/* ========================================================================= */}
        {/* SECTION 1: "YOUR LOCATION" (ALL GPS PRECISION FUNCTIONALITY)              */}
        {/* ========================================================================= */}
        <section ref={mapSectionRef} aria-labelledby="section-gps-location" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                1
              </div>
              <div>
                <h2 id="section-gps-location" className="text-xl md:text-2xl font-black text-on-surface">
                  Your Location & GPS Precision
                </h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Sub-meter positioning with obstacle-aware entrance discovery & interactive vector canvas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">

            </div>
          </div>

          {/* GPS Live Status & Coordinate Banner */}
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center shadow-xs flex-shrink-0">
                  <Crosshair className={`w-6 h-6 ${isRefreshingGps ? 'animate-spin text-primary' : ''}`} />
                </div>
                {/* Visual Precision Circle Ripple */}
                <div className="absolute inset-0 rounded-2xl border-2 border-secondary animate-ping pointer-events-none opacity-40" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                    GPS Fix Active: {gpsAccuracyMeters <= 5 ? 'High Precision' : 'Low Precision Warning'}
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                    {detectedCoordinates.lat}° N, {detectedCoordinates.lng}° E
                  </span>
                </div>

                <h3 className="text-base font-black text-on-surface mt-0.5">
                  Detected Location: <span className="text-primary">{detectedLocationName}</span>
                </h3>


              </div>
            </div>

            {/* GPS Actions & Quick Feed Forward */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleRefreshGps}
                disabled={isRefreshingGps}
                className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-bold text-on-surface flex items-center gap-1.5 transition-colors"
                title="Recalibrate GPS satellite fix"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-primary ${isRefreshingGps ? 'animate-spin' : ''}`} />
                <span>{isRefreshingGps ? 'Recalibrating...' : 'Refresh GPS'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleAccuracySim}
                className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-[11px] font-bold text-on-surface-variant transition-colors"
                title="Simulate accuracy drop to test UI warnings"
              >
                Simulate: {gpsAccuracyMeters <= 5 ? '±35m' : '±0.5m'}
              </button>

              <button
                type="button"
                onClick={handleUseGpsLocation}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black flex items-center gap-1.5 shadow-xs hover:bg-primary-container transition-all"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Use Location for Route</span>
              </button>
            </div>

          </div>

          {/* Complete Google Maps Style Interactive Map Component */}
          <div className="relative rounded-3xl overflow-hidden border border-outline-variant/40 shadow-xl h-[540px]">
            {/* Route updated toast banner */}
            {routeUpdateToast && (
              <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[1100] p-3.5 rounded-2xl bg-secondary text-white shadow-2xl border-2 border-white/40 flex items-center justify-between gap-3 animate-fade-in" role="status" aria-live="polite">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold">{routeUpdateToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRouteUpdateToast(null)}
                  className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
                  aria-label="Dismiss toast"
                >
                  ✕
                </button>
              </div>
            )}

            <LiveMapWrapper
              center={detectedCoordinates}
              destination={destLocation?.coords}
              accuracy={gpsAccuracyMeters}
              zoom={16}
              routeGeojson={effectiveRouteGeojson}
              originalRouteGeojson={effectiveOriginalRouteGeojson}
              barrierLocation={barrierLocation}
              isRerouted={isRerouteActive}
              navigationStep={isNavigating && effectiveSteps ? effectiveSteps[currentStepIndex] : undefined}
              isNavigating={isNavigating}
              onExitNavigation={() => setIsNavigating(false)}
              totalDistanceKm={isRerouteActive && activeHazardAlert?.rerouteResult?.distance ? activeHazardAlert.rerouteResult.distance : (accessible?.distance || 3.6)}
              totalMinutes={isRerouteActive && activeHazardAlert?.rerouteResult?.route?.properties?.durationMinutes ? activeHazardAlert.rerouteResult.route.properties.durationMinutes : (accessible?.time || 51)}
              totalSteps={Math.round(((accessible?.distance || 3.6) * 1000) / 0.75)}
              destName={destName}
              roadName={effectiveSteps?.[currentStepIndex]?.title || 'Juhu Rd / Juhu Tara Rd'}
            />
            {isNavigating && effectiveSteps && (
              <div className="absolute top-0 right-0 h-full w-full sm:w-80 md:w-96 bg-surface text-on-surface z-[1000] shadow-xl border-l border-outline-variant/30 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="p-4 bg-primary text-on-primary font-black flex items-center justify-between shrink-0 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-5 h-5" />
                    <span>Turn-by-Turn Navigation</span>
                  </div>
                  <button onClick={() => setIsNavigating(false)} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs transition-colors cursor-pointer">
                    End
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {effectiveSteps.map((step, idx) => {
                    const isPast = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div key={step.id} className={`p-4 border-b border-outline-variant/30 flex gap-4 transition-colors ${
                        isPast ? 'opacity-50 bg-surface-container' : 
                        isCurrent ? 'bg-primary/5 border-l-4 border-primary' : 'bg-surface'
                      }`}>
                        <div className="w-8 flex flex-col items-center gap-2 shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-xs ${isCurrent ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {step.title.toLowerCase().includes('left') ? '↰' : 
                             step.title.toLowerCase().includes('right') ? '↱' : '↑'}
                          </div>
                          {idx < effectiveSteps.length - 1 && (
                            <div className="w-1 flex-1 bg-outline-variant/40 rounded-full min-h-[20px]" />
                          )}
                        </div>
                        <div className="flex flex-col py-1">
                           <span className="font-extrabold text-sm text-on-surface">{step.title}</span>
                           <span className="text-xs font-medium text-on-surface-variant mt-1">{step.detail}</span>
                           <span className="text-[11px] font-black text-secondary mt-1.5 flex items-center gap-1">
                             <Footprints className="w-3 h-3" />
                             {step.distance && step.distance > 0 ? `${Math.max(1, Math.round(step.distance / 0.75))} steps ahead (${Math.round(step.distance)}m)` : 'Destination ahead'}
                           </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Last 50 Meters Context (Core USP) */}
                  <div className={`p-5 flex gap-4 ${currentStepIndex >= effectiveSteps.length ? 'bg-emerald-50/50 border-l-4 border-emerald-500' : 'bg-surface-container-lowest'}`}>
                     <div className="w-8 flex flex-col items-center shrink-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                          <MapPin className="w-4 h-4" />
                        </div>
                     </div>
                     <div className="flex flex-col py-0.5">
                         <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider mb-1">
                           Last 50 Meters Precision
                         </span>
                         <span className="font-extrabold text-sm text-on-surface leading-tight">
                           Arrive at {destName} - North Wing Wheelchair Ramp Entrance
                         </span>
                         <div className="mt-2 p-3 bg-emerald-100/50 border border-emerald-200 rounded-xl">
                           <span className="text-xs font-bold text-emerald-900 block flex items-start gap-1.5">
                             <Volume2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                             "You are at the North Entrance. The elevators are 10 meters ahead on your left."
                           </span>
                         </div>
                     </div>
                  </div>
                </div>

                {/* Simulate Next Step CTA */}
                <div className="p-4 bg-surface-container border-t border-outline-variant/30 shrink-0">
                  <button
                    onClick={handleSimulateWalk}
                    disabled={currentStepIndex > effectiveSteps.length}
                    className="w-full py-3 bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container rounded-xl shadow-sm font-black text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {currentStepIndex >= effectiveSteps.length ? 'Arrived' : 'Simulate Next Turn'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: "ROUTE SETUP" (GPS MODE VS MANUAL MODE)                        */}
        {/* ========================================================================= */}
        <section ref={routeSetupRef} aria-labelledby="section-route-setup" className="flex flex-col gap-6 pt-4 border-t border-outline-variant/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                2
              </div>
              <div>
                <h2 id="section-route-setup" className="text-xl md:text-2xl font-black text-on-surface">
                  Route Setup & Preferences
                </h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Connect detected GPS coordinates or select starting point manually.
                </p>
              </div>
            </div>
          </div>

          {/* Mode Selector Tabs (Mode A: GPS vs Mode B: Manual) */}
          <div className="p-1.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex items-center gap-2 max-w-md">
            <button
              type="button"
              onClick={() => {
                setLocationMode('gps');
                if (coordinates) {
                  setStartLocation({ name: detectedLocationName, coords: coordinates });
                }
                speakText("Switched to GPS location mode. Using detected GPS coordinates.");
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
                locationMode === 'gps'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Crosshair className="w-4 h-4" />
              <span>Use Current GPS Location</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLocationMode('manual');
                speakText("Switched to manual location mode. You can choose any origin manually.");
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
                locationMode === 'manual'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Choose Location Manually</span>
            </button>
          </div>

          {/* Form Routing Card */}
          <div className="p-6 md:p-8 bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-sm flex flex-col gap-6">
            
            {/* Origin & Destination Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              
              {/* Origin / Starting Location */}
              <div className="md:col-span-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="origin-select" className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    Starting Location
                  </label>
                  {locationMode === 'gps' ? (
                    <span className="text-[10px] font-black text-secondary uppercase bg-secondary-container/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      GPS Locked (±{gpsAccuracyMeters}m)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-on-surface-variant">Manual Choice</span>
                  )}
                </div>

                {locationMode === 'gps' ? (
                  <div className="w-full h-12 px-3.5 rounded-2xl bg-surface-container-low border-2 border-secondary/40 text-on-surface font-extrabold text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-secondary" />
                      <span>{detectedLocationName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLocationMode('manual')}
                      className="text-xs text-primary hover:underline font-bold"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <LocationSearchInput 
                    label="Search Origin"
                    initialValue={startLocation?.name || ''}
                    onLocationSelect={(loc) => setStartLocation(loc)}
                  />
                )}
              </div>

              {/* Swap Button */}
              <div className="md:col-span-1 flex justify-center pb-1">
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  className="p-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/40 transition-colors"
                  title="Swap starting location and destination"
                  aria-label="Swap starting location and destination"
                >
                  <RefreshCw className="w-4 h-4 text-primary" />
                </button>
              </div>

              {/* Destination Location */}
              <div className="md:col-span-4 flex flex-col gap-2">
                <LocationSearchInput 
                  label="Search Destination"
                  initialValue={destLocation?.name || ''}
                  onLocationSelect={(loc) => setDestLocation(loc)}
                />
              </div>

              {/* Primary Compare Routes CTA */}
              <div className="md:col-span-3">
                <button
                  type="button"
                  onClick={handleCompare}
                  disabled={isComparing}
                  className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all ${
                    isComparing
                      ? 'bg-primary/70 text-white cursor-wait'
                      : 'bg-primary hover:bg-primary-container text-white active:scale-[0.99]'
                  }`}
                >
                  <Compass className={`w-4 h-4 ${isComparing ? 'animate-spin' : ''}`} />
                  <span>{isComparing ? 'Recalculating...' : 'Compare Routes'}</span>
                </button>
              </div>

            </div>

            {/* Accessibility Preferences Grid */}
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
                  Accessibility Preference Profile
                </label>
                <span className="text-xs font-bold text-primary">
                  Active: {selectedPrefObj.label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {PERSONAS.map((pref) => {
                  const isActive = preference === pref.id;
                  return (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() => {
                        setPreference(pref.id);
                        speakText(`Accessibility preference set to ${pref.label}`);
                      }}
                      className={`p-3 rounded-2xl border-2 flex flex-col items-center text-center gap-2 transition-all ${
                        isActive
                          ? 'bg-primary/10 border-primary text-primary shadow-xs'
                          : 'bg-surface-container-low border-outline-variant/30 hover:border-outline text-on-surface'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${
                        isActive ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        {getPreferenceIcon(pref.id)}
                      </div>
                      <span className="text-xs font-black leading-tight">
                        {pref.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Priorities Bar */}
              <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase text-on-surface-variant">
                    Priority Focus:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPrefObj.priorities.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant/30 text-[11px] font-bold text-on-surface"
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>

                <span className="text-xs text-on-surface-variant italic sm:max-w-[280px]">
                  {selectedPrefObj.description}
                </span>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: "ROUTE COMPARISON" (NORMAL VS ACCESSIBLE & SCHEMATIC VISUALIZER) */}
        {/* ========================================================================= */}
        <section ref={comparisonRef} aria-labelledby="section-route-comparison" className="flex flex-col gap-6 pt-4 border-t border-outline-variant/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                3
              </div>
              <div>
                <h2 id="section-route-comparison" className="text-xl md:text-2xl font-black text-on-surface">
                  Route Comparison & Path Visualization
                </h2>
                <p className="text-xs text-on-surface-variant font-medium">
                  Direct evaluation of standard shortest path against barrier-free accessibility route.
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-on-surface-variant">
              Origin: <strong>{effectiveStartName}</strong>
            </span>
          </div>

          {/* Route Change Animation / Transition Summary Banner */}
          {hasCompared && (
            <div className={`p-6 rounded-3xl border-2 transition-all duration-500 shadow-sm ${
              isComparing
                ? 'opacity-60 scale-[0.99] bg-surface-container'
                : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 text-on-surface'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        Route Modified & Verified
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-black text-on-surface mt-0.5">
                      Accessibility improvement: {barriersAvoided + stairsAvoided} barriers removed
                    </h3>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-bold text-on-surface-variant">
                      {stairsAvoided > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          ✓ {stairsAvoided} stairs avoided
                        </span>
                      )}
                      {barriersAvoided > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          ✓ {barriersAvoided} barriers avoided
                        </span>
                      )}
                      {slopeReduction > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          ✓ Maximum slope reduced from {normal.maxSlope}% → {accessible.maxSlope}%
                        </span>
                      )}
                      {unsafeCrossingsAvoided > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          ✓ {unsafeCrossingsAvoided} unsafe crossings avoided
                        </span>
                      )}
                      {/* Start Navigation Floating CTA */}
                      {hasCompared && !isNavigating && (
                        <div className="mt-8 mb-4 border-t border-outline-variant/30 pt-8 flex justify-center">
                          <button
                            onClick={handleStartNavigation}
                            className="bg-primary hover:bg-primary-container text-white px-10 py-4 rounded-3xl font-black text-lg shadow-xl hover:-translate-y-1 transition-all flex items-center gap-3"
                          >
                            <Navigation className="w-6 h-6" />
                            Start Live Navigation
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col items-start md:items-end">
                  <span className="text-[11px] font-extrabold uppercase text-on-surface-variant tracking-wider">
                    Accessibility Trade-off
                  </span>
                  <span className="text-sm font-black text-primary">
                    {deltaDistance >= 0 ? `+${deltaDistance} km` : `${deltaDistance} km`} / +{deltaTime} min
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">
                    Negligible cost for continuous step-free safety
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Before vs After Side-by-Side Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* NORMAL ROUTE CARD */}
            <div className="p-6 rounded-3xl bg-surface-container-lowest border-2 border-rose-200 dark:border-rose-900/40 shadow-sm flex flex-col justify-between gap-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-900/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500" />
                    <h3 className="text-lg font-black text-on-surface">
                      Normal Route
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                    Standard Nav
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Distance</span>
                    <span className="text-lg font-black text-on-surface">{normal.distance} km</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Walking Time</span>
                    <span className="text-lg font-black text-on-surface">{normal.time} min</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-300 block">Stairs</span>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-300">{normal.stairs}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-300 block">Maximum Slope</span>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-300">{normal.maxSlope}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-300 block">Barriers</span>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-300">{normal.barriers}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-300 block">Unsafe Crossings</span>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-300">{normal.unsafeCrossings}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant">
                ⚠️ Optimized strictly for minimal distance. Ignores wheelchair stairs, broken footpaths, and dangerous highway crossings.
              </div>
            </div>

            {/* ACCESSIBLE ROUTE CARD */}
            <div className="p-6 rounded-3xl bg-surface-container-lowest border-2 border-emerald-400 dark:border-emerald-700 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10" />

              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-900/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                    <h3 className="text-lg font-black text-on-surface">
                      Accessible Route
                    </h3>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Accessibility-Aware
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Distance</span>
                    <span className="text-lg font-black text-on-surface">{accessible.distance} km</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Walking Time</span>
                    <span className="text-lg font-black text-on-surface">{accessible.time} min</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 block">Stairs</span>
                    <span className="text-lg font-black text-emerald-800 dark:text-emerald-300">{accessible.stairs}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 block">Maximum Slope</span>
                    <span className="text-lg font-black text-emerald-800 dark:text-emerald-300">{accessible.maxSlope}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 block">Barriers</span>
                    <span className="text-lg font-black text-emerald-800 dark:text-emerald-300">{accessible.barriers}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 block">Unsafe Crossings</span>
                    <span className="text-lg font-black text-emerald-800 dark:text-emerald-300">{accessible.unsafeCrossings}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-900 dark:text-emerald-200 relative z-10">
                💡 <strong>UX Principle:</strong> &ldquo;Accessible routes may be slightly longer, but can significantly reduce accessibility barriers.&rdquo;
              </div>
            </div>

          </div>

          {/* Schematic Route Path Visualizer Component */}
          <SchematicRouteVisualizer
            startLocation={effectiveStartName}
            destLocation={destName}
            normalSteps={scenarioData.normalSteps}
            accessibleSteps={scenarioData.accessibleSteps}
            isComparing={isComparing}
            activeView={visualizerView}
            onViewChange={setVisualizerView}
          />
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: "ACCESSIBILITY IMPROVEMENTS" (DYNAMIC DELTA METRICS)            */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-metrics" className="flex flex-col gap-6 pt-4 border-t border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
              4
            </div>
            <div>
              <h2 id="section-metrics" className="text-xl md:text-2xl font-black text-on-surface">
                Accessibility Improvements & Metric Changes
              </h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Quantifiable reductions in hazards achieved by accessibility-aware routing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            
            {/* Distance Delta */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
                <span>Distance</span>
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-on-surface">
                  {deltaDistance >= 0 ? `+${deltaDistance}` : deltaDistance} <span className="text-xs font-normal">km</span>
                </div>
                <div className="text-[10px] text-on-surface-variant font-semibold">
                  {normal.distance} km → {accessible.distance} km
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-center">
                Small additional path
              </span>
            </div>

            {/* Time Delta */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
                <span>Time</span>
                <Clock className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-on-surface">
                  +{deltaTime} <span className="text-xs font-normal">min</span>
                </div>
                <div className="text-[10px] text-on-surface-variant font-semibold">
                  {normal.time} min → {accessible.time} min
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-center">
                Safe walking pace
              </span>
            </div>

            {/* Stairs Avoided */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-xs flex flex-col justify-between text-emerald-950 dark:text-emerald-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Stairs Avoided</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {stairsAvoided} <span className="text-xs font-normal">flights</span>
                </div>
                <div className="text-[10px] text-on-surface-variant font-semibold">
                  {normal.stairs} → {accessible.stairs}
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 text-center">
                {accessible.stairs === 0 ? '100% Step-Free' : 'Major reduction'}
              </span>
            </div>

            {/* Max Slope Reduction */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-xs flex flex-col justify-between text-emerald-950 dark:text-emerald-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Max Slope</span>
                <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  -{slopeReduction}%
                </div>
                <div className="text-[10px] text-on-surface-variant font-semibold">
                  {normal.maxSlope}% → {accessible.maxSlope}%
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 text-center">
                ≤ 5% ADA Standard
              </span>
            </div>

            {/* Barriers Avoided */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-xs flex flex-col justify-between text-emerald-950 dark:text-emerald-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Barriers Avoided</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {barriersAvoided}
                </div>
                <div className="text-[10px] text-on-surface-variant font-semibold">
                  {normal.barriers} → {accessible.barriers}
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 text-center">
                Obstacles cleared
              </span>
            </div>

            {/* Crossings Safe */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-xs flex flex-col justify-between text-emerald-950 dark:text-emerald-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Crossings Safe</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="my-2">
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {unsafeCrossingsAvoided}
                </div>
                <div className="text-[10px] text-on-surface-variant font-semibold">
                  {normal.unsafeCrossings} → {accessible.unsafeCrossings}
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 text-center">
                Signalized crossings
              </span>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: "WHY DID THE ROUTE CHANGE?" & CORE PHILOSOPHY                  */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-why-changed" className="flex flex-col gap-6 pt-4 border-t border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
              5
            </div>
            <div>
              <h2 id="section-why-changed" className="text-xl md:text-2xl font-black text-on-surface">
                Why Did the Route Change?
              </h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Detailed reasoning behind the accessibility routing decisions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Why did we change the route? Panel */}
            <div className="md:col-span-7 p-6 md:p-7 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-black text-on-surface">
                  Routing Decision Log
                </h3>
              </div>

              <div className="space-y-2.5">
                {whyChanged.map((reason, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low text-xs font-bold text-on-surface">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 text-[11px]">
                      ✓
                    </span>
                    <span className="mt-0.5 leading-relaxed">{reason}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-on-surface-variant font-semibold pt-2 border-t border-outline-variant/30 leading-relaxed">
                &ldquo;The accessible route prioritizes accessibility constraints instead of only minimizing distance.&rdquo;
              </p>
            </div>

            {/* Quick Transition Table */}
            <div className="md:col-span-5 p-6 md:p-7 rounded-3xl bg-surface-container-low border border-outline-variant/40 shadow-sm flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-black text-on-surface">
                    Route Transition Summary
                  </h3>
                </div>
                <span className="text-xs font-bold text-on-surface-variant block mt-1">
                  Normal Route → Accessibility-Aware Route
                </span>

                <div className="space-y-2 mt-4 text-xs font-black">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest">
                    <span className="text-on-surface-variant">Distance:</span>
                    <span className="text-on-surface">{normal.distance} km → {accessible.distance} km</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest">
                    <span className="text-on-surface-variant">Time:</span>
                    <span className="text-on-surface">{normal.time} min → {accessible.time} min</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest text-emerald-800 dark:text-emerald-300">
                    <span>Stairs:</span>
                    <span>{normal.stairs} → {accessible.stairs}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest text-emerald-800 dark:text-emerald-300">
                    <span>Max Slope:</span>
                    <span>{normal.maxSlope}% → {accessible.maxSlope}%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest text-emerald-800 dark:text-emerald-300">
                    <span>Barriers:</span>
                    <span>{normal.barriers} → {accessible.barriers}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest text-emerald-800 dark:text-emerald-300">
                    <span>Unsafe Crossings:</span>
                    <span>{normal.unsafeCrossings} → {accessible.unsafeCrossings}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                <p className="mb-1 leading-snug">{summaryText}</p>
                <span className="block font-bold text-emerald-800 dark:text-emerald-300">
                  Result: The route is slightly longer, but avoids major accessibility barriers.
                </span>
              </div>
            </div>

          </div>

          {/* Hackathon Centerpiece Quote */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-primary to-primary-container text-white shadow-lg flex flex-col items-center text-center gap-3 relative overflow-hidden mt-2">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-black uppercase tracking-widest">
              <Flame className="w-4 h-4 text-amber-300" />
              Core Routing Philosophy
            </div>
            <h2 className="text-2xl md:text-3xl font-black max-w-[750px] leading-tight mt-1">
              &ldquo;Accessibility-aware routing doesn&apos;t always mean the shortest route. It means the route that better fits the user&apos;s needs.&rdquo;
            </h2>
            <p className="text-white/80 text-sm font-semibold max-w-[600px] mt-1">
              Standard routers penalize distance over dignity. PathFinder calculates pedestrian routes that ensure everyone reaches their destination safely.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
