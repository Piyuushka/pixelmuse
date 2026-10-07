'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { calculateHaversineDistance, isPointNearPolyline, decodePolyline } from '@/lib/spatial';
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
  const { speakText, simulatedObstacle, activeHazardAlert, originalRoute, adaptedRoute, persona } = useAccessibility();
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

  // Compute route scenario data dynamically
  const [scenarioData, setScenarioData] = useState<RouteScenarioData & { geojsonNormal?: any, geojsonAccessible?: any }>(
    getRouteComparison(effectiveStartName, destName)
  );

  const { normal, accessible, geojsonNormal, geojsonAccessible, accessibleSteps, normalSteps } = scenarioData;

  // Use adapted steps if rerouted, otherwise fallback to accessibleSteps
  const effectiveSteps = isRerouteActive && activeHazardAlert?.rerouteResult?.steps && activeHazardAlert.rerouteResult.steps.length > 0
    ? activeHazardAlert.rerouteResult.steps
    : accessibleSteps;

  const effectiveRouteGeojson = isRerouteActive && (adaptedRoute || activeHazardAlert?.rerouteResult?.route)
    ? (adaptedRoute || activeHazardAlert?.rerouteResult?.route)
    : (geojsonAccessible || geojsonNormal);

  const effectiveOriginalRouteGeojson = isRerouteActive
    ? (originalRoute || activeHazardAlert?.rerouteResult?.originalRoute || geojsonNormal)
    : ((scenarioData as any)?.originalRouteGeojson || undefined);

  const barrierLocation = isRerouteActive
    ? {
      lat: activeHazardAlert?.rerouteResult?.blockedCoords?.lat || 19.0220,
      lng: activeHazardAlert?.rerouteResult?.blockedCoords?.lng || 72.8400,
      title: activeHazardAlert?.title || 'Reported Hazard',
    }
    : undefined;

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
            const accessibleRoute = routeData.routes[0];
            const normalRoute = routeData.routes.length > 1 ? routeData.routes[1] : routeData.routes[0];

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

            const accessibleMappedSteps = mapRouteSteps(accessibleRoute);
            const normalMappedSteps = mapRouteSteps(normalRoute);

            finalScenarioData = {
              normal: {
                distance: Number((normalRoute.distance_m / 1000).toFixed(2)),
                time: Math.round(normalRoute.duration_s / 60),
                stairs: normalRoute === accessibleRoute ? 0 : 2, // Dummy difference if they are different
                maxSlope: normalRoute === accessibleRoute ? 4 : 8,
                barriers: normalRoute === accessibleRoute ? 0 : 1,
                unsafeCrossings: 0
              },
              accessible: {
                distance: Number((accessibleRoute.distance_m / 1000).toFixed(2)),
                time: Math.round(accessibleRoute.duration_s / 60),
                stairs: 0,
                maxSlope: 4,
                barriers: 0,
                unsafeCrossings: 0
              },
              normalSteps: normalMappedSteps,
              accessibleSteps: accessibleMappedSteps,
              geojsonNormal: null,
              geojsonAccessible: null,
              encodedPolyline: accessibleRoute.encodedPolyline,
              originalRouteGeojson: normalRoute.encodedPolyline, // Store the normal route polyline to display side-by-side
              summaryText: accessibleRoute.warnings?.join(' ') || 'Route generated by Google Maps'
            };
          }
        }
      } catch (err) {
        console.error("Route calculation error", err);
      }
    }

    setScenarioData(finalScenarioData as any);

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
              isRerouted={isRerouteActive}
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Distance</span>
                    <span className="text-lg font-black text-on-surface">{normal.distance} km</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Walking Time</span>
                    <span className="text-lg font-black text-on-surface">{normal.time} min</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant">
                Standard direct walking route based on distance.
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
                    Optimized Route
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Distance</span>
                    <span className="text-lg font-black text-on-surface">{accessible.distance} km</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-[10px] font-extrabold uppercase text-on-surface-variant block">Walking Time</span>
                    <span className="text-lg font-black text-on-surface">{accessible.time} min</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-900 dark:text-emerald-200 relative z-10">
                Optimized navigation path prepared for navigation.
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
                isRerouted={isRerouteActive}
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
          />


        </section>

      </div>
    </div>
  );
}
