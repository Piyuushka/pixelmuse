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
import { getLiveRouteScenario, geocodeNominatim } from '@/lib/orsClient';
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
  const { speakText, simulatedObstacle, persona } = useAccessibility();
  const searchParams = useSearchParams();

  const urlDest = searchParams?.get('dest');
  const urlPersona = searchParams?.get('persona') as PersonaType | null;
  const urlMode = searchParams?.get('mode') as 'gps' | 'manual' | null;
  const urlAutonav = searchParams?.get('autonav') === '1' || searchParams?.get('autonav') === 'true';

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
  
  const detectedLocationName = error ? 'Location Unavailable' : (coordinates ? 'Live Position' : 'Acquiring GPS...');
  const detectedCoordinates = coordinates || { lat: 19.0178, lng: 72.8478 }; // Fallback to Dadar
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

  // Effective starting location based on mode
  const effectiveStartName = locationMode === 'gps' ? detectedLocationName : (startLocation?.name || 'Origin');
  const destName = destLocation?.name || 'Destination';

  // Compute route scenario data dynamically
  const [scenarioData, setScenarioData] = useState<RouteScenarioData & { geojsonNormal?: any, geojsonAccessible?: any }>(
    getRouteComparison(effectiveStartName, destName, preference)
  );

  const { normal, accessible, whyChanged, summaryText, geojsonNormal, geojsonAccessible, accessibleSteps, normalSteps } = scenarioData;

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

    // 1. Geocode searchDestination text via OpenStreetMap Nominatim if coordinates are missing
    if (!targetDestCoords && destName) {
      const nomResult = await geocodeNominatim(destName);
      if (nomResult) {
        targetDestCoords = nomResult.coordinates;
        targetDestName = nomResult.name;
        setDestLocation({ name: nomResult.name, coords: nomResult.coordinates });
      }
    }

    const mockData = getRouteComparison(effectiveStartName, targetDestName, preference);
    
    const sCoords = locationMode === 'gps' && coordinates ? coordinates : startLocation?.coords;

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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

        {/* Prototype Disclaimer Pill */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs font-bold">
              Demo data — GPS readings and urban accessibility conditions are simulated for prototype demonstration in Mumbai, Maharashtra, India.
            </span>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 hidden sm:inline-block">
            Simulated Prototype
          </span>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: "YOUR LOCATION" (ALL GPS PRECISION FUNCTIONALITY)              */}
        {/* ========================================================================= */}
        <section aria-labelledby="section-gps-location" className="flex flex-col gap-6">
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
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-2xs ${
                gpsAccuracyMeters <= 5
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200'
              }`}>
                <ShieldCheck className="w-4 h-4" />
                <span>Accuracy ±{gpsAccuracyMeters}m</span>
              </span>
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

                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  {gpsAccuracyMeters <= 5 ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      ✓ Your starting location is precise enough for high-accuracy route comparison.
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">
                      ⚠️ Location accuracy is low (±{gpsAccuracyMeters}m). Route starting point may be approximate.
                    </span>
                  )}
                </p>
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
          <div className="relative rounded-3xl overflow-hidden border border-outline-variant/40 shadow-md h-[450px]">
            <LiveMapWrapper
              center={detectedCoordinates}
              accuracy={gpsAccuracyMeters}
              zoom={14}
              routeGeojson={preference === 'none' ? geojsonNormal : (geojsonAccessible || geojsonNormal)}
              navigationStep={isNavigating && accessibleSteps ? accessibleSteps[currentStepIndex] : undefined}
            />
            {isNavigating && accessibleSteps && currentStepIndex < accessibleSteps.length && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-surface-container-lowest/95 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-outline-variant/30 flex items-center gap-4 w-11/12 max-w-md">
                <div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-inner">
                  {/* Pseudo turn icon based on instruction text */}
                  {accessibleSteps[currentStepIndex].title.toLowerCase().includes('left') ? '⬅️' : 
                   accessibleSteps[currentStepIndex].title.toLowerCase().includes('right') ? '➡️' : '⬆️'}
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-xs font-black text-primary uppercase tracking-wide">
                    {accessibleSteps[currentStepIndex].distance ? `In ${accessibleSteps[currentStepIndex].distance}m` : 'Next Turn'}
                  </span>
                  <span className="text-base font-extrabold text-on-surface leading-tight">
                    {accessibleSteps[currentStepIndex].title}
                  </span>
                </div>
              </div>
            )}
            
            {isNavigating && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
                <button
                  onClick={handleSimulateWalk}
                  className="px-4 py-2 bg-secondary text-white rounded-xl shadow-lg font-bold text-sm"
                >
                  Simulate Walk
                </button>
                <button
                  onClick={() => setIsNavigating(false)}
                  className="px-4 py-2 bg-error text-white rounded-xl shadow-lg font-bold text-sm"
                >
                  End Navigation
                </button>
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
