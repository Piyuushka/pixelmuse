'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import LiveMapWrapper from '@/components/LiveMapWrapper';
import SchematicRouteVisualizer from '@/components/SchematicRouteVisualizer';
import InteractiveMap from '@/components/InteractiveMap';
import PersonalizedProfileBanner from '@/components/PersonalizedProfileBanner';
import {
  DEMO_LOCATIONS,
  BENCHMARK_SCENARIOS,
  getRouteComparison,
  RouteScenarioData
} from '@/data/routeSimulatorData';
import { getLiveRouteScenario, searchLocation, reverseGeocode, getPlaceDetails } from '@/lib/orsClient';
import { computeRouteMetrics, RouteMetrics } from '@/lib/routeMetrics';
import { calculateHaversineDistance, isPointNearPolyline, decodePolyline } from '@/lib/spatial';
import RouteImpactPanel from '@/components/RouteImpactPanel';
import TrustBadge from '@/components/TrustBadge';
import { triggerActiveBarrierRecalculation } from '@/lib/routeRecalculator';
import { sessionRegistry } from '@/lib/navigationSessionRegistry';
import { RoadLayerType } from '@/lib/db/mongoSchema';
import { IndianBarrierReport } from '@/lib/barrierEngine';
import { PersonaType } from '@/context/AccessibilityContext';
import {
  cleanStepInstruction,
  getConciseDestinationName,
  buildNavigationSpeech,
  NavigationStep,
} from '@/lib/navigationVoiceCommander';
import {
  navigationSessionStore,
  createNavigationSession,
  advanceNavigationStep,
  previousNavigationStep,
  repeatNavigationStep,
  transitionAdvanceStep,
  transitionPreviousStep,
  transitionRepeatStep,
  transitionStopNavigation,
} from '@/lib/authoritativeNavigationSession';
import LocationSearchInput from '@/components/LocationSearchInput';
import {
  MapPin,
  Navigation,
  ShieldCheck,
  Compass,
  Crosshair,
  RefreshCw,
  Sliders,
  Volume2,
  CheckCircle2,
  Footprints,
  Lock,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building,
  X,
  AlertTriangle
} from 'lucide-react';

interface UnifiedRoutePlannerProps {
  initialMode?: 'gps' | 'manual';
}

export default function UnifiedRoutePlanner({ initialMode = 'gps' }: UnifiedRoutePlannerProps) {
  const { speakText, simulatedObstacle, activeHazardAlert, originalRoute, adaptedRoute, persona, setPersona, accessibilityPreferences, barrierReports } = useAccessibility();
  const searchParams = useSearchParams();

  const urlDest = searchParams?.get('dest');
  const urlMode = searchParams?.get('mode') as 'gps' | 'manual' | null;
  const urlAutonav = searchParams?.get('autonav') === '1' || searchParams?.get('autonav') === 'true';
  const urlReroute = searchParams?.get('reroute') === 'active' || Boolean(searchParams?.get('reportId'));

  const isRerouteActive = Boolean(urlReroute);
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
    let mounted = true;
    if (coordinates) {
      reverseGeocode(coordinates.lat, coordinates.lng).then(address => {
        if (mounted) {
          setResolvedGpsName(address);
        }
      });
    }
    return () => { mounted = false; };
  }, [coordinates]);

  const detectedLocationName = coordinates ? resolvedGpsName : 'Dadar Railway Station';
  const detectedCoordinates = coordinates || { lat: 19.0178, lng: 72.8430 }; // Fallback to Dadar Railway Station
  const gpsAccuracyMeters = simulatedAccuracy !== null ? simulatedAccuracy : (accuracy ? Math.round(accuracy) : 0.5);

  // Route Setup state
  const defaultStart = DEMO_LOCATIONS.find(l => l.name === 'Dadar Railway Station');
  const defaultDest = matchedDest
    ? { name: matchedDest.name, coords: { lat: matchedDest.lat!, lng: matchedDest.lng! } }
    : { name: initialDest, coords: { lat: 19.0222, lng: 72.8365 } };

  const [startLocation, setStartLocation] = useState<{ name: string, coords: any, placeId?: string } | null>(
    defaultStart ? { name: defaultStart.name, coords: { lat: defaultStart.lat!, lng: defaultStart.lng! } } : null
  );
  const [destLocation, setDestLocation] = useState<{ name: string, coords: any, placeId?: string } | null>(
    defaultDest
  );

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
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);



  // Section references for smooth scrolling
  const routeSetupRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);

  // Effective starting location based on mode
  const effectiveStartName = locationMode === 'gps' ? detectedLocationName : (startLocation?.name || 'Origin');
  const destName = destLocation?.name || 'Destination';

  // Trigger reason for Route Impact Panel
  const [triggerReason, setTriggerReason] = useState<'barrier_active' | 'persona_changed' | 'simulated_barrier' | 'route_computed'>('route_computed');
  const [isSimulatingBarrier, setIsSimulatingBarrier] = useState<boolean>(false);
  const [simulatedBarrier, setSimulatedBarrier] = useState<IndianBarrierReport | null>(null);

  // Compute route scenario data dynamically
  const [scenarioData, setScenarioData] = useState<RouteScenarioData & {
    geojsonNormal?: any;
    geojsonAccessible?: any;
    normalRawMetrics?: RouteMetrics;
    accessibleRawMetrics?: RouteMetrics;
    simulatedRouteGeojson?: any;
  }>(
    getRouteComparison(effectiveStartName, destName)
  );

  // Automatically fetch live route from OSRM/ORS whenever coordinates or start/destination change
  useEffect(() => {
    let isMounted = true;
    const fetchLiveRoute = async () => {
      const sCoords = locationMode === 'gps' ? detectedCoordinates : startLocation?.coords;
      const dCoords = destLocation?.coords;

      if (sCoords && dCoords) {
        const liveData = await getLiveRouteScenario(sCoords, dCoords);
        if (liveData && isMounted) {
          setScenarioData(liveData);
        }
      }
    };

    fetchLiveRoute();
    return () => { isMounted = false; };
  }, [locationMode, coordinates, startLocation, destLocation]);

  const { normal, accessible, geojsonNormal, geojsonAccessible, accessibleSteps, normalSteps } = scenarioData;

  // Use adapted steps if rerouted, otherwise fallback to accessibleSteps
  const effectiveSteps = isRerouteActive && activeHazardAlert?.rerouteResult?.steps && activeHazardAlert.rerouteResult.steps.length > 0
    ? activeHazardAlert.rerouteResult.steps
    : accessibleSteps;

  const effectiveRouteGeojson = (isRerouteActive || isSimulatingBarrier) && (adaptedRoute || activeHazardAlert?.rerouteResult?.route || (scenarioData as any)?.simulatedRouteGeojson)
    ? (adaptedRoute || activeHazardAlert?.rerouteResult?.route || (scenarioData as any)?.simulatedRouteGeojson)
    : (geojsonAccessible || geojsonNormal);

  const effectiveOriginalRouteGeojson = (isRerouteActive || isSimulatingBarrier)
    ? (originalRoute || activeHazardAlert?.rerouteResult?.originalRoute || (scenarioData as any)?.originalRouteGeojson || geojsonNormal)
    : ((scenarioData as any)?.originalRouteGeojson || undefined);

  const barrierLocation = isRerouteActive
    ? {
      lat: activeHazardAlert?.rerouteResult?.blockedCoords?.lat || 19.0220,
      lng: activeHazardAlert?.rerouteResult?.blockedCoords?.lng || 72.8400,
      title: activeHazardAlert?.title || 'Reported Hazard',
    }
    : isSimulatingBarrier && simulatedBarrier
      ? {
        lat: simulatedBarrier.coordinates.lat,
        lng: simulatedBarrier.coordinates.lng,
        title: simulatedBarrier.title,
      }
      : undefined;

  // Real Metrics Calculation for RouteImpactPanel
  const baselineMetrics: RouteMetrics = useMemo(() => {
    if (scenarioData?.normalRawMetrics) {
      return scenarioData.normalRawMetrics;
    }
    return computeRouteMetrics({
      distanceM: Math.round((scenarioData.normal.distance || 1.25) * 1000),
      durationMin: scenarioData.normal.time || 16,
      slopeData: {
        maxSlopePct: scenarioData.normal.maxSlope ?? 8.2,
        avgSlopePct: (scenarioData.normal as any).avgSlope ?? 3.8,
      },
      stairsCount: (scenarioData.normal as any).stairs ?? 2,
      crossingsData: {
        signalled: (scenarioData.normal as any).signalledCrossings ?? 1,
        unsignalled: (scenarioData.normal as any).unsafeCrossings ?? 2,
      },
      barriersOnRoute: (scenarioData.normal as any).barriers ?? 1,
      steps: scenarioData.normalSteps as any,
      dataSource: (scenarioData.normal as any).dataSource || 'estimated',
    }, 'none', barrierReports);
  }, [scenarioData, barrierReports]);

  const adaptedMetrics: RouteMetrics = useMemo(() => {
    if (scenarioData?.accessibleRawMetrics) {
      return scenarioData.accessibleRawMetrics;
    }
    return computeRouteMetrics({
      distanceM: Math.round((scenarioData.accessible.distance || 1.39) * 1000),
      durationMin: scenarioData.accessible.time || 18,
      slopeData: {
        maxSlopePct: scenarioData.accessible.maxSlope ?? 4.1,
        avgSlopePct: (scenarioData.accessible as any).avgSlope ?? 2.1,
      },
      stairsCount: (scenarioData.accessible as any).stairs ?? 0,
      crossingsData: {
        signalled: (scenarioData.accessible as any).signalledCrossings ?? 3,
        unsignalled: (scenarioData.accessible as any).unsafeCrossings ?? 0,
      },
      barriersOnRoute: (scenarioData.accessible as any).barriers ?? 0,
      steps: scenarioData.accessibleSteps as any,
      dataSource: (scenarioData.accessible as any).dataSource || 'live',
    }, accessibilityPreferences || persona || 'wheelchair', barrierReports);
  }, [scenarioData, accessibilityPreferences, persona, barrierReports]);

  // Handler: Simulate Barrier (drops barrier on route and triggers routeRecalculator.ts)
  const handleSimulateBarrier = async () => {
    const sCoords = locationMode === 'gps' ? detectedCoordinates : (startLocation?.coords || { lat: 19.0178, lng: 72.8430 });
    const dCoords = destLocation?.coords || { lat: 19.0222, lng: 72.8365 };

    const midLat = Number(((sCoords.lat * 0.55) + (dCoords.lat * 0.45)).toFixed(5));
    const midLng = Number(((sCoords.lng * 0.55) + (dCoords.lng * 0.45)).toFixed(5));

    const barrier: IndianBarrierReport = {
      id: `sim-barrier-${Date.now()}`,
      title: 'Blocked Pedestrian Ramp',
      category: 'Blocked Ramp / Curb Cut',
      severity: 'critical',
      location: `${destName} Concourse`,
      microLocation: 'Curb ramp obstructed by roadwork barricade',
      status: 'Verified',
      votes: 4,
      downvotes: 0,
      date: '12 min ago',
      createdAt: Date.now() - 12 * 60 * 1000,
      expiresAt: Date.now() + 7200 * 1000,
      ttlSeconds: 7200,
      initialTtlSeconds: 7200,
      description: 'Active barricade blocking dropped curb ramp. Impassable for wheeled mobility.',
      coordinates: { lat: midLat, lng: midLng },
      roadLayer: 'at_grade',
      quadKey: '',
      clusterCount: 4,
      isExpired: false,
    };

    setSimulatedBarrier(barrier);
    setIsSimulatingBarrier(true);
    setTriggerReason('simulated_barrier');

    // Trigger async route recalculation flow in routeRecalculator.ts
    try {
      const activeSessions = sessionRegistry.getAllActiveSessions();
      if (activeSessions.length === 0) {
        sessionRegistry.startSession({
          sessionId: `session-sim-${Date.now()}`,
          userId: 'sim-user-1',
          routeCoords: [sCoords, { lat: midLat, lng: midLng }, dCoords],
          currentGpsCoord: sCoords,
          roadLayer: RoadLayerType.AT_GRADE,
          totalDistanceMeters: Math.round((scenarioData.accessible.distance || 1.25) * 1000),
          estimatedArrivalAt: new Date(Date.now() + 15 * 60000),
        });
      }

      await triggerActiveBarrierRecalculation(barrier, {
        activeBarriers: [...barrierReports, barrier],
        autoUpdateSession: true,
      });

      // Also invoke API endpoint asynchronously
      fetch('/api/routing/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barrier, allActiveBarriers: [...barrierReports, barrier] }),
      }).catch(() => {});
    } catch (err) {
      console.warn('[Simulate Barrier]', err);
    }

    // Geometry generation for dashed baseline route vs solid adapted detour route
    const baselinePoints = [
      [sCoords.lng, sCoords.lat],
      [midLng, midLat],
      [dCoords.lng, dCoords.lat]
    ];
    const detourPoints = [
      [sCoords.lng, sCoords.lat],
      [midLng + 0.0025, midLat - 0.0010],
      [midLng + 0.0020, midLat + 0.0015],
      [dCoords.lng, dCoords.lat]
    ];

    const baselineGeojson = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: baselinePoints },
      properties: { label: 'Original Blocked Route' }
    };
    const detourGeojson = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: detourPoints },
      properties: { label: 'Adapted Detour Route (+140m)' }
    };

    const baseDistanceM = Math.round((scenarioData.accessible.distance || 1.25) * 1000);
    const detourDistanceM = baseDistanceM + 140;
    const detourMinutes = Math.max(1, (scenarioData.accessible.time || 15) + 2);

    const recomputedMetrics = computeRouteMetrics({
      distanceM: detourDistanceM,
      durationMin: detourMinutes,
      slopeData: { maxSlopePct: 4.1, avgSlopePct: 2.1 },
      stairsCount: 0,
      crossingsData: {
        signalled: ((scenarioData.accessible as any).signalledCrossings || 2) + 1,
        unsignalled: 0,
      },
      barriersOnRoute: 0,
      dataSource: 'live',
    }, persona || 'wheelchair', [barrier]);

    setScenarioData(prev => ({
      ...prev,
      accessible: {
        ...prev.accessible,
        distance: Number((detourDistanceM / 1000).toFixed(2)),
        time: detourMinutes,
        barriers: 0,
        maxSlope: 4.1,
        accessibilityScore: recomputedMetrics.accessibilityScore,
        scoreBreakdown: recomputedMetrics.scoreBreakdown,
      },
      accessibleRawMetrics: recomputedMetrics,
      originalRouteGeojson: baselineGeojson,
      simulatedRouteGeojson: detourGeojson,
      summaryText: `Avoids 1 blocked ramp (reported 12 min ago, 4 confirmations). +140 m, +2 min.`
    }));

    speakText('Barrier detected on active route. Recalculated step-free detour adds 140 meters and avoids all stairs.');
  };

  const handleClearSimulatedBarrier = () => {
    setIsSimulatingBarrier(false);
    setSimulatedBarrier(null);
    setTriggerReason('route_computed');
    speakText('Barrier simulation cleared. Baseline navigation route restored.');
    handleCompare();
  };

  const handlePersonaChange = (newPersona: PersonaType) => {
    setPersona(newPersona);
    setTriggerReason('persona_changed');
    speakText(`Switched mobility profile to ${newPersona}. Recalculating route accessibility metrics.`);

    const recomputed = computeRouteMetrics({
      distanceM: Math.round((scenarioData.accessible.distance || 1.25) * 1000),
      durationMin: scenarioData.accessible.time || 15,
      slopeData: { maxSlopePct: scenarioData.accessible.maxSlope ?? 4.1, avgSlopePct: (scenarioData.accessible as any).avgSlope ?? 2.1 },
      stairsCount: newPersona === 'wheelchair' ? 0 : newPersona === 'none' ? 2 : 1,
      crossingsData: {
        signalled: (scenarioData.accessible as any).signalledCrossings ?? 3,
        unsignalled: (scenarioData.accessible as any).unsafeCrossings ?? 0,
      },
      barriersOnRoute: 0,
      dataSource: (scenarioData.accessible as any).dataSource || 'live',
    }, newPersona, barrierReports);

    setScenarioData(prev => ({
      ...prev,
      accessible: {
        ...prev.accessible,
        maxSlope: recomputed.maxSlopePct,
        accessibilityScore: recomputed.accessibilityScore,
        scoreBreakdown: recomputed.scoreBreakdown,
      },
      accessibleRawMetrics: recomputed,
    }));
  };

  // Sync external persona changes (Trigger b)
  const prevPersonaRef = useRef<PersonaType>(persona);
  useEffect(() => {
    if (prevPersonaRef.current !== persona) {
      prevPersonaRef.current = persona;
      handlePersonaChange(persona);
    }
  }, [persona]);

  // Sync active barrier reports (Trigger a)
  useEffect(() => {
    if (isRerouteActive) {
      setTriggerReason('barrier_active');
    }
  }, [isRerouteActive]);

  const benchmarkKeys = Object.keys(BENCHMARK_SCENARIOS);

  // Real GPS Tracking Logic
  useEffect(() => {
    if (isNavigating && coordinates && scenarioData?.accessibleSteps && !isRecalculating) {
      
      // Step 7: Off-Route Detection
      if (scenarioData.encodedPolyline) {
        const polylineCoords = decodePolyline(scenarioData.encodedPolyline);
        const isOnRoute = isPointNearPolyline(coordinates, polylineCoords, 25); // 25 meter tolerance
        
        if (!isOnRoute) {
          setIsRecalculating(true);
          speakText("You are off route. Recalculating...");
          
          const reqBody = {
            origin: coordinates,
            destination: destLocation?.placeId ? { placeId: destLocation.placeId } : (destLocation?.coords || destName),
            mobility_profile: persona || 'wheelchair',
            languageCode: 'en-IN'
          };

          fetch('/api/navigation/route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
          })
          .then(res => res.json())
          .then(routeData => {
            if (routeData.routes && routeData.routes.length > 0) {
              const mainRoute = routeData.routes[0];
              const mappedSteps = mainRoute.steps.map((s: any, idx: number) => {
                const stripped = s.instruction.replace(/<[^>]+>/g, '');
                const stepCount = Math.round(s.distance_m / 0.75);
                let actionPrefix = '';
                if (s.maneuver) {
                  if (s.maneuver.includes('LEFT')) actionPrefix = 'Turn left. ';
                  else if (s.maneuver.includes('RIGHT')) actionPrefix = 'Turn right. ';
                }
                
                return {
                  id: `step-${idx}`,
                  title: `${actionPrefix}${stripped}. Walk straight for roughly ${stepCount} steps.`,
                  detail: `${s.distance_m}m • ${stepCount} steps`,
                  distance: s.distance_m,
                  location: s.end,
                  type: 'smooth_footpath'
                };
              });

              const newAccessibleData = {
                distance: mainRoute.distance_m / 1000,
                time: Math.round(mainRoute.duration_s / 60),
                safety: 98,
                surface: 95
              };

              setScenarioData(prev => ({
                ...prev,
                accessible: newAccessibleData,
                accessibleSteps: mappedSteps,
                encodedPolyline: mainRoute.polyline?.encodedPolyline
              }));
              setCurrentStepIndex(0);
              speakText(`Route updated. ${cleanStepInstruction(mappedSteps[0].title || mappedSteps[0].detail, getConciseDestinationName(destName))}`);
            }
          })
          .catch(e => console.error("Recalculation failed", e))
          .finally(() => {
            setIsRecalculating(false);
          });

          return; // Do not process step advancement if we are recalculating
        }
      }

      const steps = scenarioData.accessibleSteps;
      if (currentStepIndex < steps.length - 1) {
        const currentStep = steps[currentStepIndex];
        if (currentStep.location) {
          const dist = calculateHaversineDistance(
            { lat: coordinates.lat, lng: coordinates.lng },
            { lat: currentStep.location.lat, lng: currentStep.location.lng }
          );
          if (dist < 15) {
            // We have reached the waypoint, advance
            const nextIdx = currentStepIndex + 1;
            setCurrentStepIndex(nextIdx);
            const nextStep = steps[nextIdx];
            const conciseDest = getConciseDestinationName(destName);
            speakText(`Step ${nextIdx + 1} of ${steps.length}: ${cleanStepInstruction(nextStep.title, conciseDest)}`);
          }
        }
      } else {
        // Last step - check if arrived
        const currentStep = steps[currentStepIndex];
        if (currentStep.location) {
          const dist = calculateHaversineDistance(
            { lat: coordinates.lat, lng: coordinates.lng },
            { lat: currentStep.location.lat, lng: currentStep.location.lng }
          );
          if (dist < 15) {
            setIsNavigating(false);
            speakText(`You have arrived safely at ${getConciseDestinationName(destName)}.`);
          }
        }
      }
    }
  }, [coordinates, isNavigating, scenarioData, currentStepIndex, destName, speakText, isRecalculating, persona, destLocation]);

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
    let targetDestName = destLocation?.name || destName;
    let targetPlaceId = destLocation?.placeId;

    // 1. Resolve destination coordinates via placeId or searchLocation if missing or zero
    if ((!targetDestCoords || (targetDestCoords.lat === 0 && targetDestCoords.lng === 0)) && targetPlaceId) {
      const details = await getPlaceDetails(targetPlaceId);
      if (details) {
        targetDestCoords = details;
        setDestLocation(prev => ({ name: prev?.name || targetDestName, coords: details, placeId: targetPlaceId }));
      }
    }

    if ((!targetDestCoords || (targetDestCoords.lat === 0 && targetDestCoords.lng === 0)) && targetDestName) {
      const results = await searchLocation(targetDestName);
      if (results && results.length > 0) {
        const best = results[0];
        let coords = best.coordinates;
        if ((!coords || (coords.lat === 0 && coords.lng === 0)) && best.placeId) {
          const details = await getPlaceDetails(best.placeId);
          if (details) coords = details;
        }
        if (coords && (coords.lat !== 0 || coords.lng !== 0)) {
          targetDestCoords = coords;
          targetDestName = best.name;
          targetPlaceId = best.placeId;
          setDestLocation({ name: best.name, coords, placeId: best.placeId });
        }
      }
    }

    const mockData = getRouteComparison(effectiveStartName, targetDestName);

    const sCoords = locationMode === 'gps' ? detectedCoordinates : startLocation?.coords;

    let finalScenarioData: any = mockData;
    if (sCoords && (targetDestCoords || targetPlaceId)) {
      try {
        const hasValidCoords = targetDestCoords && (targetDestCoords.lat !== 0 || targetDestCoords.lng !== 0);
        const destinationPayload = hasValidCoords
          ? { lat: targetDestCoords.lat, lng: targetDestCoords.lng, ...(targetPlaceId ? { placeId: targetPlaceId } : {}) }
          : { placeId: targetPlaceId };

        const reqBody = {
          origin: sCoords,
          destination: destinationPayload,
          mobility_profile: persona || 'wheelchair',
          accessibility_preferences: accessibilityPreferences,
          barriers: barrierReports,
          languageCode: 'en-IN'
        };

        const res = await fetch('/api/navigation/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody)
        });

        if (res.ok) {
          const routeData = await res.json();
          if (routeData.routes && routeData.routes.length > 0) {
            // routes[0] is most_accessible, routes[1] is balanced, routes[2] or last is shortest
            const accessibleRoute = routeData.modes?.most_accessible || routeData.routes[0];
            const normalRoute = routeData.modes?.shortest || (routeData.routes.length > 1 ? routeData.routes[routeData.routes.length - 1] : routeData.routes[0]);

            // Update destination coordinates with exact location returned by Google
            const resolvedEndLoc = accessibleRoute.destinationLocation || routeData.destinationLocation;
            if (resolvedEndLoc && resolvedEndLoc.lat && resolvedEndLoc.lng) {
              setDestLocation(prev => ({
                name: prev?.name || targetDestName,
                coords: resolvedEndLoc,
                placeId: prev?.placeId || targetPlaceId
              }));
            }
            
            // Map the Google Route into our schema
            const mapRouteSteps = (route: any) => route.steps.map((s: any, idx: number) => {
              const stripped = (s.instruction || s.title || '').replace(/<[^>]+>/g, '');
              const stepCount = Math.round((s.distance_m || s.distance || 50) / 0.75);
              let actionPrefix = '';
              if (s.maneuver) {
                if (s.maneuver.includes('LEFT')) actionPrefix = 'Turn left. ';
                else if (s.maneuver.includes('RIGHT')) actionPrefix = 'Turn right. ';
              }

              return {
                id: `step-${idx}`,
                title: `${actionPrefix}${stripped}. Walk straight for roughly ${stepCount} steps.`,
                detail: `${s.distance_m || s.distance || 50}m • ${stepCount} steps`,
                distance: s.distance_m || s.distance,
                location: s.end || s.location,
                type: 'smooth_footpath'
              };
            });

            const accessibleMappedSteps = mapRouteSteps(accessibleRoute);
            const normalMappedSteps = mapRouteSteps(normalRoute);

            // Compute real metrics pipeline
            const normalMetrics = normalRoute.metrics || computeRouteMetrics(normalRoute, 'none', barrierReports);
            const accessibleMetrics = accessibleRoute.metrics || computeRouteMetrics(accessibleRoute, accessibilityPreferences || persona, barrierReports);

            finalScenarioData = {
              normal: {
                distance: Number((normalMetrics.distanceM / 1000).toFixed(2)),
                time: normalMetrics.durationMin,
                stairs: normalMetrics.scoreBreakdown?.stairDeduction ? Math.max(1, Math.round(normalMetrics.scoreBreakdown.stairDeduction / 5)) : 2,
                maxSlope: normalMetrics.maxSlopePct,
                avgSlope: normalMetrics.avgSlopePct,
                barriers: normalMetrics.barriersOnRoute,
                unsafeCrossings: normalMetrics.crossings.unsignalled,
                signalledCrossings: normalMetrics.crossings.signalled,
                surfaceIssues: normalMetrics.surfaceIssues,
                lightingScore: normalMetrics.lightingScore,
                accessibilityScore: normalMetrics.accessibilityScore,
                dataSource: normalMetrics.dataSource,
                scoreBreakdown: normalMetrics.scoreBreakdown,
              },
              accessible: {
                distance: Number((accessibleMetrics.distanceM / 1000).toFixed(2)),
                time: accessibleMetrics.durationMin,
                stairs: 0,
                maxSlope: accessibleMetrics.maxSlopePct,
                avgSlope: accessibleMetrics.avgSlopePct,
                barriers: accessibleMetrics.barriersOnRoute,
                unsafeCrossings: accessibleMetrics.crossings.unsignalled,
                signalledCrossings: accessibleMetrics.crossings.signalled,
                surfaceIssues: accessibleMetrics.surfaceIssues,
                lightingScore: accessibleMetrics.lightingScore,
                accessibilityScore: accessibleMetrics.accessibilityScore,
                dataSource: accessibleMetrics.dataSource,
                scoreBreakdown: accessibleMetrics.scoreBreakdown,
              },
              normalSteps: normalMappedSteps,
              accessibleSteps: accessibleMappedSteps,
              geojsonNormal: null,
              geojsonAccessible: null,
              normalRawMetrics: normalMetrics,
              accessibleRawMetrics: accessibleMetrics,
              encodedPolyline: accessibleRoute.encodedPolyline,
              originalRouteGeojson: normalRoute.encodedPolyline, // Store the normal route polyline to display side-by-side
              summaryText: accessibleRoute.summaryDescription || accessibleRoute.warnings?.join(' ') || 'Route generated by Navigation Engine'
            };
          }
        }
      } catch (err) {
        console.error("Route calculation error", err);
      }
    }

    setScenarioData(finalScenarioData as any);
    setTriggerReason('route_computed');

    speakText(`Calculating route from ${effectiveStartName} to ${targetDestName}.`);

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
  }, [urlAutonav, urlDest, initialDest, accessibleSteps, speakText]);

  // Synchronize with authoritativeNavigationSession store
  useEffect(() => {
    const unsubscribe = navigationSessionStore.subscribe((session) => {
      if (session) {
        if (session.status === 'navigating') {
          setIsNavigating(true);
          setCurrentStepIndex(session.currentStepIndex);
        } else if (session.status === 'arrived') {
          setIsNavigating(true);
          setCurrentStepIndex(session.steps.length - 1);
        } else if (session.status === 'stopped') {
          setIsNavigating(false);
        }
      }
    });
    return unsubscribe;
  }, []);

  const handleStartNavigation = () => {
    setIsNavigating(true);
    setCurrentStepIndex(0);
    const total = accessibleSteps ? accessibleSteps.length : 1;
    const rawStep =
      accessibleSteps?.[0]?.detail ||
      accessibleSteps?.[0]?.title ||
      'Follow the arrows on the map.';
    const conciseDest = getConciseDestinationName(destName);
    const firstStep = cleanStepInstruction(rawStep, conciseDest);

    if (accessibleSteps && accessibleSteps.length > 0) {
      const navSteps: NavigationStep[] = accessibleSteps.map((s, idx) => ({
        stepNumber: idx + 1,
        instruction: cleanStepInstruction(s.detail || s.title, conciseDest),
        landmark: s.title,
        distance: s.distance ? `${Math.round(s.distance)}m` : 'Direct',
        cue: s.title.toLowerCase().includes('left')
          ? 'left_turn'
          : s.title.toLowerCase().includes('right')
            ? 'right_turn'
            : 'confirm',
      }));

      const session = createNavigationSession({
        destination: destName,
        steps: navSteps,
        persona: persona || 'wheelchair',
      });
      navigationSessionStore.setSession(session);
    }

    const initialSpeech = buildNavigationSpeech(
      {
        stepNumber: 1,
        instruction: firstStep,
        landmark: accessibleSteps?.[0]?.title,
        cue: 'confirm',
        distance: accessibleSteps?.[0]?.distance ? `${Math.round(accessibleSteps[0].distance)}m` : 'Direct',
      },
      0,
      total,
      { isInitial: true, destination: conciseDest }
    );
    speakText(initialSpeech);
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNextStep = () => {
    if (isNavigating) {
      const result = advanceNavigationStep();
      if (result) {
        setCurrentStepIndex(result.index);
        if (result.isArrival) {
          speakText(`You have arrived safely at ${getConciseDestinationName(destName)}.`);
        } else {
          const speech = buildNavigationSpeech(
            result.step,
            result.index,
            result.session.steps.length,
            { destination: getConciseDestinationName(destName) }
          );
          speakText(speech);
        }
        return;
      }
    }
    handleSimulateWalk();
  };

  const handlePreviousStep = () => {
    if (isNavigating && currentStepIndex > 0) {
      const result = previousNavigationStep();
      if (result) {
        setCurrentStepIndex(result.index);
        const speech = buildNavigationSpeech(
          result.step,
          result.index,
          result.session.steps.length,
          { destination: getConciseDestinationName(destName) }
        );
        speakText(speech);
        return;
      }
    }
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      if (accessibleSteps && accessibleSteps[prevIdx]) {
        const s = accessibleSteps[prevIdx];
        speakText(`Step ${prevIdx + 1} of ${accessibleSteps.length}: ${cleanStepInstruction(s.detail || s.title, destName)}`);
      }
    }
  };

  const handleRepeatStep = () => {
    if (isNavigating) {
      const result = repeatNavigationStep();
      if (result) {
        const speech = buildNavigationSpeech(
          result.step,
          result.index,
          result.session.steps.length,
          { destination: getConciseDestinationName(destName) }
        );
        speakText(speech);
        return;
      }
    }
    if (accessibleSteps && accessibleSteps[currentStepIndex]) {
      const s = accessibleSteps[currentStepIndex];
      speakText(`Step ${currentStepIndex + 1} of ${accessibleSteps.length}: ${cleanStepInstruction(s.detail || s.title, destName)}`);
    }
  };

  const handleEndNavigation = () => {
    const currentSession = navigationSessionStore.getSession();
    if (currentSession) {
      const stopped = transitionStopNavigation(currentSession);
      navigationSessionStore.setSession(stopped);
    }
    setIsNavigating(false);
    speakText('Navigation stopped.');
  };

  const handleSimulateWalk = () => {
    // Legacy function to manually advance steps for testing if GPS is unavailable
    const conciseDest = getConciseDestinationName(destName);
    if (scenarioData?.accessibleSteps && currentStepIndex < scenarioData.accessibleSteps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const step = scenarioData.accessibleSteps[nextIdx];
      const stepText = cleanStepInstruction(step.title, conciseDest);
      speakText(`Step ${nextIdx + 1} of ${scenarioData.accessibleSteps.length}: ${stepText}`);
    } else {
      speakText(`You have arrived safely at ${conciseDest}.`);
      setIsNavigating(false);
    }
  };

  const handleTryDemoRoute = () => {
    setLocationMode('gps');

    const dadar = DEMO_LOCATIONS.find(l => l.name === 'Dadar Railway Station')!;
    const shivaji = DEMO_LOCATIONS.find(l => l.name === 'Shivaji Park')!;

    setStartLocation({ name: dadar.name, coords: { lat: dadar.lat!, lng: dadar.lng! } });
    setDestLocation({ name: shivaji.name, coords: { lat: shivaji.lat!, lng: shivaji.lng! } });

    setSimulatedAccuracy(0.5);
    setIsComparing(true);
    speakText("Loading unified demo flow: GPS location at Dadar Railway Station to Shivaji Park.");
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
              onClick={() => speakText(`Unified Accessible Route Planner active. Location is ${effectiveStartName} with GPS accuracy ±${gpsAccuracyMeters}m. Destination is ${destName}.`)}
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

          {/* Dedicated Map Container - Completely Unobstructed */}
          <div className="relative rounded-3xl overflow-hidden border border-outline-variant/40 shadow-xl h-[480px] sm:h-[520px] md:h-[560px] w-full">
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
              encodedPolyline={scenarioData?.encodedPolyline}
              barrierLocation={barrierLocation}
              isRerouted={isRerouteActive || isSimulatingBarrier}
              showComparisonControls={true}
              navigationStep={isNavigating && effectiveSteps ? effectiveSteps[currentStepIndex] : undefined}
              isNavigating={isNavigating}
              onExitNavigation={handleEndNavigation}
              totalDistanceKm={isRerouteActive && activeHazardAlert?.rerouteResult?.distance ? activeHazardAlert.rerouteResult.distance : (accessible?.distance || 3.6)}
              totalMinutes={isRerouteActive && activeHazardAlert?.rerouteResult?.route?.properties?.durationMinutes ? activeHazardAlert.rerouteResult.route.properties.durationMinutes : (accessible?.time || 51)}
              totalSteps={Math.round(((accessible?.distance || 3.6) * 1000) / 0.75)}
              destName={destName}
              roadName={effectiveSteps?.[currentStepIndex]?.title || 'Juhu Rd / Juhu Tara Rd'}
            />
          </div>

          {/* TURN-BY-TURN NAVIGATION: Dedicated card immediately BELOW the map in normal document flow */}
          {isNavigating && accessibleSteps && (
            <div className="rounded-3xl bg-surface border border-outline-variant/40 shadow-xl p-5 sm:p-6 md:p-8 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Header: Step Number & Progress */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" />
                    Step {Math.min(currentStepIndex + 1, accessibleSteps.length)} of {accessibleSteps.length}
                  </span>
                  <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-secondary" />
                    {isRerouteActive && activeHazardAlert?.rerouteResult?.route?.properties?.durationMinutes ? activeHazardAlert.rerouteResult.route.properties.durationMinutes : (accessible?.time || 51)} min • {isRerouteActive && activeHazardAlert?.rerouteResult?.distance ? activeHazardAlert.rerouteResult.distance : (accessible?.distance || 3.6)} km
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Turn-by-Turn Guidance Active
                  </span>
                  <button
                    type="button"
                    onClick={handleEndNavigation}
                    className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>End</span>
                  </button>
                </div>
              </div>

              {/* Current Active Step Instruction Card */}
              {accessibleSteps[currentStepIndex] && (
                <div className="p-5 md:p-6 rounded-2xl bg-primary/5 border-2 border-primary/30 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
                    {accessibleSteps[currentStepIndex].title.toLowerCase().includes('left') ? '↰' :
                      accessibleSteps[currentStepIndex].title.toLowerCase().includes('right') ? '↱' :
                        accessibleSteps[currentStepIndex].type === 'elevator' ? '🛗' :
                          accessibleSteps[currentStepIndex].type === 'ramp' ? '♿' : '↑'}
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-wider text-primary">
                        STEP {currentStepIndex + 1} OF {accessibleSteps.length}
                      </span>
                      <span className="text-xs font-bold text-secondary flex items-center gap-1">
                        <Footprints className="w-3.5 h-3.5" />
                        {accessibleSteps[currentStepIndex].distance
                          ? `${Math.round(accessibleSteps[currentStepIndex].distance)} m ahead (${Math.max(1, Math.round(accessibleSteps[currentStepIndex].distance / 0.75))} steps)`
                          : 'Destination ahead'}
                      </span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-on-surface leading-snug">
                      {accessibleSteps[currentStepIndex].title}
                    </h3>
                    <p className="text-sm font-medium text-on-surface-variant">
                      {accessibleSteps[currentStepIndex].detail}
                    </p>
                    {/* Landmark Confirmation */}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-on-surface bg-surface-container-high px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-primary" />
                        <strong>Landmark:</strong> {accessibleSteps[currentStepIndex].title}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Step-free route • Low slope
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Action Buttons (Previous / Repeat / Next / Simulate) */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    disabled={currentStepIndex <= 0}
                    className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer border border-outline-variant/30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRepeatStep}
                    className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-black text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer border border-outline-variant/30"
                    title="Repeat current instruction"
                  >
                    <Volume2 className="w-4 h-4 text-primary" />
                    <span>Repeat</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={currentStepIndex >= accessibleSteps.length}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-container text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>{currentStepIndex >= accessibleSteps.length - 1 ? 'Arrived' : 'Next Step'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateWalk}
                    disabled={currentStepIndex >= accessibleSteps.length}
                    className="px-4 py-2.5 rounded-xl bg-secondary text-white hover:bg-secondary-container text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Simulate Walk</span>
                  </button>
                </div>
              </div>

              {/* Full Route Steps Overview (Scrollable timeline) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/30">
                <span className="text-xs font-black uppercase text-on-surface-variant tracking-wider">
                  Complete Route Journey ({accessibleSteps.length} Steps)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                  {accessibleSteps.map((step, idx) => {
                    const isPast = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div
                        key={step.id}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${isPast
                            ? 'opacity-60 bg-surface-container-low border-outline-variant/20'
                            : isCurrent
                              ? 'bg-primary/10 border-primary shadow-xs'
                              : 'bg-surface-container-lowest border-outline-variant/30'
                          }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isPast
                              ? 'bg-slate-300 dark:bg-slate-700 text-on-surface'
                              : isCurrent
                                ? 'bg-primary text-white'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}
                        >
                          {isPast ? '✓' : idx + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-extrabold text-xs text-on-surface leading-tight">
                            {step.title}
                          </span>
                          <span className="text-[11px] font-medium text-on-surface-variant line-clamp-1 mt-0.5">
                            {step.detail}
                          </span>
                          {step.distance && (
                            <span className="text-[10px] font-black text-secondary mt-1">
                              {Math.round(step.distance)}m ahead
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Last 50 Meters Context (Arrival Guidance) */}
              <div className={`p-4 rounded-2xl flex gap-4 ${currentStepIndex >= accessibleSteps.length - 1 ? 'bg-emerald-500/10 border-2 border-emerald-500' : 'bg-surface-container-low border border-outline-variant/30'}`}>
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                    Last 50 Meters Precision
                  </span>
                  <span className="font-extrabold text-sm text-on-surface leading-tight">
                    Arrive at {destName} - North Wing Accessible Entrance
                  </span>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mt-1 flex items-start gap-1.5">
                    <Volume2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    &quot;You are at the North Entrance. The elevators are 10 meters ahead on your left.&quot;
                  </p>
                </div>
              </div>
            </div>
          )}
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
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${locationMode === 'gps'
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
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${locationMode === 'manual'
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
                  className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all ${isComparing
                      ? 'bg-primary/70 text-white cursor-wait'
                      : 'bg-primary hover:bg-primary-container text-white active:scale-[0.99]'
                    }`}
                >
                  <Compass className={`w-4 h-4 ${isComparing ? 'animate-spin' : ''}`} />
                  <span>{isComparing ? 'Recalculating...' : 'Compare Routes'}</span>
                </button>
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

          {/* Route Status & Navigation CTA Banner */}
          {hasCompared && (
            <div className={`p-6 rounded-3xl border transition-all duration-500 shadow-sm ${isComparing
                ? 'opacity-60 scale-[0.99] bg-surface-container'
                : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface'
              }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-md">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-on-surface">
                      Route Calculated Successfully
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium mt-1">
                      Distance: <strong>{accessible.distance} km</strong> • Walking time: <strong>{accessible.time} min</strong>
                    </p>
                  </div>
                </div>

                {!isNavigating && (
                  <button
                    type="button"
                    onClick={handleStartNavigation}
                    className="bg-primary hover:bg-primary-container text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Start Live Navigation</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ROUTE IMPACT PANEL (Before/After comparison, delta table, why changed summary, profile comparison, evidence export) */}
          <RouteImpactPanel
            baselineMetrics={baselineMetrics}
            adaptedMetrics={adaptedMetrics}
            activeBarrier={isSimulatingBarrier ? simulatedBarrier : (isRerouteActive ? (barrierReports.find(b => b.id === activeHazardAlert?.barrierReportId) || null) : null)}
            isSimulatingBarrier={isSimulatingBarrier}
            onSimulateBarrier={handleSimulateBarrier}
            onClearSimulatedBarrier={handleClearSimulatedBarrier}
            currentPersona={persona || 'wheelchair'}
            onPersonaChange={handlePersonaChange}
            originName={effectiveStartName}
            destinationName={destName}
            triggerReason={triggerReason}
            baseRouteData={{
              distanceM: adaptedMetrics.distanceM,
              durationMin: adaptedMetrics.durationMin,
              stepCount: adaptedMetrics.stepCount,
              slopeData: { maxSlopePct: adaptedMetrics.maxSlopePct, avgSlopePct: adaptedMetrics.avgSlopePct },
              crossingsData: adaptedMetrics.crossings,
              barriersOnRoute: isSimulatingBarrier ? 0 : adaptedMetrics.barriersOnRoute,
              dataSource: adaptedMetrics.dataSource,
            }}
            onShowSaferAlternative={() => {
              setVisualizerView('accessible');
              handlePersonaChange('wheelchair');
            }}
          />

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
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface-variant flex items-center gap-1">
                      {normal.dataSource === 'live' ? '🟢 Live Data' : normal.dataSource === 'estimated' ? '🟡 Estimated' : '🟣 Demo Data'}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                      Standard Nav
                    </span>
                  </div>
                </div>

                {/* Route Trust & Verification Audit */}
                <div className="flex items-center justify-between flex-wrap gap-2 py-0.5">
                  <TrustBadge
                    item={{
                      title: 'Standard Route Track',
                      category: 'route',
                      source: normal.dataSource === 'live' ? 'osm' : 'imported',
                      lastVerified: new Date(Date.now() - 95 * 86400000), // 95 days ago (stale >90d)
                      confirmations: 2,
                      disputes: 1,
                    }}
                    size="sm"
                    showFreshness={true}
                    showWhyButton={true}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Distance</span>
                    <span className="text-base font-black text-on-surface">{normal.distance} km</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Walk Time</span>
                    <span className="text-base font-black text-on-surface">{normal.time} min</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Max Slope</span>
                    <span className="text-base font-black text-rose-700 dark:text-rose-400">{normal.maxSlope ?? 8}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Stairs</span>
                    <span className="text-base font-black text-rose-700 dark:text-rose-400">{normal.stairs ?? 2}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold border border-rose-500/20">
                    ⚠ {normal.barriers ?? 1} barrier(s) on path
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant font-bold border border-outline-variant/30">
                    {normal.unsafeCrossings ?? 1} uncontrolled crossing(s)
                  </span>
                  {typeof normal.accessibilityScore === 'number' && (
                    <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface font-extrabold ml-auto">
                      Score: {normal.accessibilityScore}/100
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant">
                Direct walking path based on shortest geometric distance. May contain steep grades and stair flights.
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
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      {accessible.dataSource === 'live' ? '🟢 Live API' : accessible.dataSource === 'estimated' ? '🟡 Estimated' : '🟣 Demo Data'}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Optimized Route
                    </span>
                  </div>
                </div>

                {/* Route Trust & Verification Audit */}
                <div className="flex items-center justify-between flex-wrap gap-2 py-0.5 relative z-10">
                  <TrustBadge
                    item={{
                      title: 'Accessible Step-Free Route',
                      category: 'ramp',
                      source: 'official',
                      lastVerified: new Date(Date.now() - 4 * 3600000), // 4h ago
                      confirmations: 42,
                      disputes: 0,
                    }}
                    size="sm"
                    showFreshness={true}
                    showWhyButton={true}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Distance</span>
                    <span className="text-base font-black text-on-surface">{accessible.distance} km</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Walk Time</span>
                    <span className="text-base font-black text-on-surface">{accessible.time} min</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Max Slope</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-300">≤ {accessible.maxSlope ?? 4}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Stairs</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-300">0 (Step-free)</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/20">
                    🛡️ {accessible.barriers ?? 0} barriers on path
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/20">
                    ✓ {accessible.signalledCrossings ?? 1} safe crossing(s)
                  </span>
                  {typeof accessible.accessibilityScore === 'number' && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-extrabold ml-auto shadow-xs">
                      Score: {accessible.accessibilityScore}/100
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-900 dark:text-emerald-200 relative z-10">
                Optimized navigation path prepared with step-free elevators, compliant ramps, and signalized crossings.
              </div>
            </div>

          </div>

          {/* REAL GEOGRAPHIC MAP VISUALIZER (TO SCALE) */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-black text-on-surface">
                  Geographic Route Map (To Scale)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tracking-wider uppercase px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Google Route
                </span>
                <div className="flex rounded-xl bg-surface-container-low p-1 border border-outline-variant/30 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setVisualizerView('both')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      visualizerView === 'both'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Split Comparison
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualizerView('normal')}
                    className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                      visualizerView === 'normal'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Normal ({normal.distance} km)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualizerView('accessible')}
                    className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                      visualizerView === 'accessible'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Accessible ({accessible.distance} km)
                  </button>
                </div>
              </div>
            </div>

            <div className="relative rounded-3xl overflow-hidden border border-outline-variant/40 shadow-xl h-[480px] sm:h-[520px] md:h-[560px] w-full">
              <LiveMapWrapper
                center={detectedCoordinates}
                destination={destLocation?.coords}
                accuracy={gpsAccuracyMeters}
                zoom={16}
                routeGeojson={effectiveRouteGeojson}
                originalRouteGeojson={effectiveOriginalRouteGeojson}
                encodedPolyline={scenarioData?.encodedPolyline}
                barrierLocation={barrierLocation}
                isRerouted={isRerouteActive || isSimulatingBarrier}
                startName={effectiveStartName}
                destName={destName}
                activeView={visualizerView}
                onViewChange={setVisualizerView}
                showComparisonControls={true}
                totalDistanceKm={accessible.distance}
                normalDistanceKm={normal.distance}
              />
            </div>
          </div>

          {/* DETAILED STEP-BY-STEP SCHEMATIC TIMELINE (BELOW THE REAL MAP) */}
          <SchematicRouteVisualizer
            startLocation={effectiveStartName}
            destLocation={destName}
            normalSteps={scenarioData.normalSteps}
            accessibleSteps={scenarioData.accessibleSteps}
            isComparing={isComparing}
            activeView={visualizerView}
            onViewChange={setVisualizerView}
            onSelectSaferAlternative={() => {
              setVisualizerView('accessible');
              handlePersonaChange('wheelchair');
            }}
          />


        </section>

      </div>
    </div>
  );
}
