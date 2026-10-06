'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  IndianBarrierReport,
  createBarrierReport,
  processIncomingBarrierReport,
  upvoteBarrier,
  downvoteBarrier,
  tickBarrierDecay,
  RoadLayer,
} from '@/lib/barrierEngine';
import { calculateAdaptedRoute, RouteResult } from '@/lib/routingEngine';
import { barrierBroadcaster, BarrierEvent, ReroutePayload } from '@/lib/realtimeEngine';
import { offlineSyncManager } from '@/lib/offlineSync';
import { getAffectedNavigatingUsers } from '@/lib/spatialLookupEngine';
import { RoadLayerType } from '@/lib/db/mongoSchema';
import { triggerActiveBarrierRecalculation } from '@/lib/routeRecalculator';
import { sessionRegistry } from '@/lib/navigationSessionRegistry';
import { realtimeClient } from '@/lib/realtimeClient';
import { safeFetchJson } from '@/lib/safeFetch';
import { SurfaceFilterPreferences, DEFAULT_SURFACE_FILTERS } from '@/lib/safetyRoutingEngine';
import { rerouteAroundBarrier, RerouteResult, RouteFeature } from '@/lib/rerouteEngine';

export type PersonaType = 'wheelchair' | 'older-adult' | 'low-vision' | 'caregiver' | 'none';
export type FontScale = 'sm' | 'md' | 'lg';

export interface ActiveObstacleAlert {
  active: boolean;
  title: string;
  location: string;
  microLocation?: string;
  detourTime: string;
  impact: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  barrierReportId?: string;
  originalRoute?: string;
  originalRouteDetail?: string;
  adaptedRoute?: string;
  adaptedRouteDetail?: string;
  isAccepted?: boolean;
  rerouteResult?: RerouteResult;
}

/**
 * Unified Persona Taxonomy — single source of truth.
 * All UI components that render persona selectors must import this array
 * instead of defining their own ad-hoc lists.
 *
 * iconName values correspond to lucide-react component names so that
 * consumers can dynamically resolve the icon component.
 */
export interface PersonaDefinition {
  id: PersonaType;
  label: string;
  iconName: string;          // lucide-react icon component name
  priorities: string[];
  description: string;
}

export const PERSONAS: PersonaDefinition[] = [
  {
    id: 'wheelchair',
    label: 'Wheelchair user',
    iconName: 'Accessibility',
    priorities: ['0 stairs / 100% step-free', 'Max 5% gentle slopes', 'Zero physical barriers', 'Accessible ramps & wide entrances', 'Controlled crossings'],
    description: 'Prioritizes step-free paths, low gradient slopes, elevator access, and curb cut ramps.',
  },
  {
    id: 'older-adult',
    label: 'Older Adult / Reduced Mobility',
    iconName: 'Footprints',
    priorities: ['Fewer or no stairs', 'Low slopes & handrails', 'Minimal obstacles', 'Step-free alternatives', 'Safe pedestrian crossings'],
    description: 'Designed for elderly users, those with crutches, braces, or limited walking stamina.',
  },
  {
    id: 'low-vision',
    label: 'Low Vision / Visual Impairment',
    iconName: 'Eye',
    priorities: ['Audible / tactile safe crossings', 'Simpler linear routes', 'Fewer complex multi-lane intersections', 'Tactile paving infrastructure'],
    description: 'Focuses on tactile ground indicators, predictable walkway geometry, and low-traffic crosswalks.',
  },
  {
    id: 'caregiver',
    label: 'Caregiver / Stroller',
    iconName: 'Heart',
    priorities: ['No step curbs', 'Wide sidewalks (>1.2m)', 'Smooth paving', 'Elevator & ramp routing'],
    description: 'Avoids turnstiles, stepped footbridges, and steep stairways for smooth wheeled transport.',
  },
  {
    id: 'none',
    label: 'No accessibility preference',
    iconName: 'Navigation',
    priorities: ['Shortest total distance', 'Direct geometric route', 'Standard city sidewalks'],
    description: 'Calculates standard shortest walking routes without accessibility constraints.',
  },
];

export interface UserProfile {
  name: string;
  email: string;
  isLoggedIn: boolean;
  hasCompletedProfile: boolean;
  role?: string;
}

export interface AccessibilityPreferences {
  primaryPersona: PersonaType;
  mobilityType: string;
  requireStepFree: boolean;
  maxSlopePercent: number;
  preferLowerSlopes: boolean;
  preferReducedDistance: boolean;
  preferSaferCrossings: boolean;
  avoidStairs: boolean;
  needTactilePaving: boolean;
  needAudioPrompts: boolean;
  maxWalkingDistanceMeters: number;
}

export interface BarrierReport extends IndianBarrierReport {}

interface AccessibilityContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  isNightMode: boolean;
  toggleNightMode: () => void;
  isHighContrast: boolean;
  toggleHighContrast: () => void;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  isVoicePromptActive: boolean;
  toggleVoicePrompt: () => void;
  speakText: (text: string, force?: boolean, onEnd?: () => void) => void;
  persona: PersonaType;
  setPersona: (p: PersonaType) => void;
  user: UserProfile;
  accessibilityPreferences: AccessibilityPreferences;
  surfaceFilters: SurfaceFilterPreferences;
  toggleSurfaceFilter: (key: keyof SurfaceFilterPreferences) => void;
  setSurfaceFilters: React.Dispatch<React.SetStateAction<SurfaceFilterPreferences>>;
  isOnboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  loginUser: (email: string, password?: string) => Promise<UserProfile>;
  registerUser: (name: string, email: string, password?: string) => Promise<UserProfile>;
  logoutUser: () => void;
  saveAccessibilityProfile: (prefs: Partial<AccessibilityPreferences>) => Promise<UserProfile>;
  simulatedObstacle: ActiveObstacleAlert;
  activeHazardAlert: ActiveObstacleAlert;
  activeAlert: ActiveObstacleAlert;
  navigationStatus: 'idle' | 'planning' | 'navigating' | 'rerouting' | 'arrived';
  setNavigationStatus: (status: 'idle' | 'planning' | 'navigating' | 'rerouting' | 'arrived') => void;
  originalRoute: RouteFeature | null;
  adaptedRoute: RouteFeature | null;
  toggleSimulatedObstacle: () => void;
  acceptReroute: () => void;
  barrierReports: BarrierReport[];
  addBarrierReport: (input: {
    title: string;
    category: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    location: string;
    microLocation?: string;
    estimatedResolutionTime?: string;
    affectsActiveRoute?: boolean;
    description?: string;
    roadLayer?: RoadLayer;
    coordinates?: { lat: number; lng: number };
  }) => Promise<{ targetId: string; rerouteResult: RerouteResult }>;
  upvoteReport: (id: string) => void;
  downvoteReport: (id: string) => void;
  resolveReport: (id: string) => void;
  currentRouteResult: RouteResult;
  recalculateCurrentRoute: () => RouteResult;
  realtimeEvents: BarrierEvent[];
  offlinePendingCount: number;
  lastReroutePayload: ReroutePayload | null;
  triggerBarrierActivation: (barrierId: string) => Promise<ReroutePayload[]>;
}

const defaultReports: IndianBarrierReport[] = [
  createBarrierReport({
    title: 'Elevator Out of Service / Escalator Down',
    category: 'Elevator Out of Service / Escalator Down',
    severity: 'critical',
    location: 'West Wing Transit Hub - Platform 2',
    microLocation: 'Elevator B Shaft (Level 1 Concourse to Level 2 Platforms)',
    estimatedResolutionTime: 'Est. 3h 30m',
    affectsActiveRoute: true,
    description: 'Hydraulic lift motor overheating. Escalator adjacent also undergoing electrical service. No step-free access.',
    coordinates: { lat: 19.0770, lng: 72.8788 },
    roadLayer: 'at_grade',
  }),
  createBarrierReport({
    title: 'Puddles / Waterlogging',
    category: 'Puddles / Waterlogging',
    severity: 'high',
    location: 'SVT Road - Underpass Entrance Gate 2',
    microLocation: 'Curb cut & tactile ground transition at Gate 2 underpass',
    estimatedResolutionTime: 'Est. 2h 0m',
    affectsActiveRoute: true,
    description: '15cm water buildup near curb ramp following monsoon shower. Wheelchair footrests will submerge.',
    coordinates: { lat: 19.0760, lng: 72.8777 },
    roadLayer: 'at_grade',
  }),
  createBarrierReport({
    title: 'Blockade / Scaffolding on Curb Cut',
    category: 'Blockade / Scaffolding on Curb Cut',
    severity: 'high',
    location: 'Main Plaza & 4th Avenue Crossing',
    microLocation: 'NE Corner pedestrian ramp beside Scaffold Bay 4',
    estimatedResolutionTime: 'Est. 8h 0m',
    affectsActiveRoute: true,
    description: 'Renovation scaffolding erected across the dropped curb cut. Sidewalk clearance reduced to 65cm.',
    coordinates: { lat: 19.0765, lng: 72.8782 },
    roadLayer: 'at_grade',
  }),
  createBarrierReport({
    title: 'Mud / Loose Gravel',
    category: 'Mud / Loose Gravel',
    severity: 'medium',
    location: 'South Concourse Garden Bypass Lane',
    microLocation: 'Compacted gravel path leading to West Pavilion',
    estimatedResolutionTime: 'Est. 4h 0m',
    affectsActiveRoute: false,
    description: 'Heavy foot traffic washed topsoil onto walkway creating slippery mud and loose pebble hazards.',
    coordinates: { lat: 19.0754, lng: 72.8780 },
    roadLayer: 'at_grade',
  }),
];

const DEFAULT_USER: UserProfile = {
  name: '',
  email: '',
  isLoggedIn: false,
  hasCompletedProfile: false,
};

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  primaryPersona: 'wheelchair',
  mobilityType: 'electric-wheelchair',
  requireStepFree: true,
  maxSlopePercent: 5,
  preferLowerSlopes: true,
  preferReducedDistance: true,
  preferSaferCrossings: true,
  avoidStairs: true,
  needTactilePaving: false,
  needAudioPrompts: true,
  maxWalkingDistanceMeters: 1000,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(DEFAULT_USER);
  const [accessibilityPreferences, setAccessibilityPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>('md');
  const [isVoicePromptActive, setIsVoicePromptActive] = useState(false);
  const [persona, setPersona] = useState<PersonaType>('wheelchair');

  // Load theme preference from localStorage or system on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedTheme = localStorage.getItem('pathfinder_theme') || localStorage.getItem('theme');
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          setIsDarkMode(true);
        }
      }
    } catch (e) {
      console.error('Failed to load theme preference:', e);
    }
  }, []);

  // Synchronize document <html>, <body> classes, attributes, color-scheme, and localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    if (isDarkMode) {
      root.classList.add('dark', 'dark-mode');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
      body.classList.add('dark', 'dark-mode');
      body.setAttribute('data-theme', 'dark');
      try {
        localStorage.setItem('pathfinder_theme', 'dark');
        localStorage.setItem('theme', 'dark');
      } catch (e) {}
    } else {
      root.classList.remove('dark', 'dark-mode');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
      body.classList.remove('dark', 'dark-mode');
      body.setAttribute('data-theme', 'light');
      try {
        localStorage.setItem('pathfinder_theme', 'light');
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Load state from localStorage & fetch fresh DB profile on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedUser = localStorage.getItem('pathfinder_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.email) {
          // Fetch authoritative profile from server database
          fetch(`/api/user/profile?email=${encodeURIComponent(parsedUser.email)}`)
            .then(res => safeFetchJson(res))
            .then(data => {
              if (data.user) {
                const freshUser: UserProfile = {
                  name: data.user.name,
                  email: data.user.email,
                  isLoggedIn: true,
                  hasCompletedProfile: data.user.hasCompletedProfile,
                };
                setUser(freshUser);
                if (data.user.accessibilityPreferences) {
                  setAccessibilityPreferences(data.user.accessibilityPreferences);
                  if (data.user.accessibilityPreferences.primaryPersona) {
                    setPersona(data.user.accessibilityPreferences.primaryPersona);
                  }
                  if (typeof data.user.accessibilityPreferences.needAudioPrompts === 'boolean') {
                    setIsVoicePromptActive(data.user.accessibilityPreferences.needAudioPrompts);
                  }
                }
              }
            })
            .catch(err => {
              console.warn('Could not fetch server profile, using cached localStorage user:', err);
              setUser(parsedUser);
            });
        }
      }
    } catch (e) {
      console.error('Failed to load user profile:', e);
    }
  }, []);

  const openOnboarding = () => setIsOnboardingOpen(true);
  const closeOnboarding = () => setIsOnboardingOpen(false);

  const loginUser = async (email: string, password?: string): Promise<UserProfile> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password || 'password123' }),
    });
    const data = await safeFetchJson(res);
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Login failed');
    }

    const dbUser: UserProfile = {
      name: data.user.name,
      email: data.user.email,
      isLoggedIn: true,
      hasCompletedProfile: data.user.hasCompletedProfile,
      role: data.user.role || 'user',
    };

    setUser(dbUser);
    if (data.user.accessibilityPreferences) {
      setAccessibilityPreferences(data.user.accessibilityPreferences);
      if (data.user.accessibilityPreferences.primaryPersona) {
        setPersona(data.user.accessibilityPreferences.primaryPersona);
      }
      if (typeof data.user.accessibilityPreferences.needAudioPrompts === 'boolean') {
        setIsVoicePromptActive(data.user.accessibilityPreferences.needAudioPrompts);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('pathfinder_user', JSON.stringify(dbUser));
      localStorage.setItem('pathfinder_token', data.token || '');
      if (data.user.accessibilityPreferences) {
        localStorage.setItem('pathfinder_preferences', JSON.stringify(data.user.accessibilityPreferences));
      }
    }

    return dbUser;
  };

  const registerUser = async (name: string, email: string, password?: string): Promise<UserProfile> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: password || 'password123' }),
    });
    const data = await safeFetchJson(res);
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Registration failed');
    }

    const dbUser: UserProfile = {
      name: data.user.name,
      email: data.user.email,
      isLoggedIn: true,
      hasCompletedProfile: false,
    };

    setUser(dbUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pathfinder_user', JSON.stringify(dbUser));
      localStorage.setItem('pathfinder_token', data.token || '');
    }

    return dbUser;
  };

  const logoutUser = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch((err) => console.error('Logout API failed:', err));
    const resetUser: UserProfile = {
      name: '',
      email: '',
      isLoggedIn: false,
      hasCompletedProfile: false,
    };
    setUser(resetUser);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pathfinder_user');
      localStorage.removeItem('pathfinder_token');
      localStorage.removeItem('pathfinder_preferences');
    }
  };

  const saveAccessibilityProfile = async (newPrefs: Partial<AccessibilityPreferences>): Promise<UserProfile> => {
    const updatedPrefs = { ...accessibilityPreferences, ...newPrefs };
    const targetEmail = user.email || 'user@community.org';

    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, preferences: updatedPrefs }),
    });
    const data = await safeFetchJson(res);
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Failed to save accessibility profile');
    }

    const updatedUser: UserProfile = {
      name: data.user.name,
      email: data.user.email,
      isLoggedIn: true,
      hasCompletedProfile: true,
    };

    setUser(updatedUser);
    if (data.user.accessibilityPreferences) {
      setAccessibilityPreferences(data.user.accessibilityPreferences);
      if (data.user.accessibilityPreferences.primaryPersona) {
        setPersona(data.user.accessibilityPreferences.primaryPersona);
      }
      if (typeof data.user.accessibilityPreferences.needAudioPrompts === 'boolean') {
        setIsVoicePromptActive(data.user.accessibilityPreferences.needAudioPrompts);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('pathfinder_user', JSON.stringify(updatedUser));
      if (data.user.accessibilityPreferences) {
        localStorage.setItem('pathfinder_preferences', JSON.stringify(data.user.accessibilityPreferences));
      }
    }

    return updatedUser;
  };
  const [surfaceFilters, setSurfaceFilters] = useState<SurfaceFilterPreferences>(DEFAULT_SURFACE_FILTERS);

  // Load surface filters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('pathfinder_surface_filters');
      if (saved) {
        setSurfaceFilters(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const toggleSurfaceFilter = useCallback((key: keyof SurfaceFilterPreferences) => {
    setSurfaceFilters(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('pathfinder_surface_filters', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const [navigationStatus, setNavigationStatus] = useState<'idle' | 'planning' | 'navigating' | 'rerouting' | 'arrived'>('navigating');
  const [originalRoute, setOriginalRoute] = useState<RouteFeature | null>(null);
  const [adaptedRoute, setAdaptedRoute] = useState<RouteFeature | null>(null);

  const [activeHazardAlert, setActiveHazardAlert] = useState<ActiveObstacleAlert>({
    active: true,
    title: 'Elevator Out of Service / Escalator Down',
    location: 'West Wing Transit Hub - Platform 2',
    microLocation: 'Elevator B Shaft (Level 1 Concourse to Level 2 Platforms)',
    detourTime: '+3 min detour',
    impact: 'Wheelchair & Stroller access redirected via South Ramp C and Service Lift 4',
    category: 'Elevator Out of Service / Escalator Down',
    severity: 'critical',
    barrierReportId: 'rep-default-1',
    originalRoute: 'Central Concourse Route (Blocked by Elevator Outage)',
    originalRouteDetail: 'Direct concourse path. Elevator out of service due to hydraulic fault. Stairs required as fallback (Not Step-Free).',
    adaptedRoute: 'South Ramp C & Lift 4 (Bypasses obstacle with +3 min detour)',
    adaptedRouteDetail: 'Bypasses elevator hub via gentle 3.5% incline ramp and service lift. 100% Step-Free & WCAG AAA Verified.',
    isAccepted: false,
  });

  const simulatedObstacle = activeHazardAlert;

  const [barrierReports, setBarrierReports] = useState<IndianBarrierReport[]>(defaultReports);
  const [realtimeEvents, setRealtimeEvents] = useState<BarrierEvent[]>([]);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [lastReroutePayload, setLastReroutePayload] = useState<ReroutePayload | null>(null);

  // Initialize initial route reroute calculation
  useEffect(() => {
    rerouteAroundBarrier(
      { lat: 19.0178, lng: 72.8430, name: 'Dadar Railway Station' },
      { lat: 19.0267, lng: 72.8375, name: 'Shivaji Park' },
      {
        title: 'Elevator Out of Service / Escalator Down',
        location: 'West Wing Transit Hub - Platform 2',
        coordinates: { lat: 19.0220, lng: 72.8400 },
        category: 'Elevator Out of Service / Escalator Down',
        severity: 'critical',
      },
      persona,
      surfaceFilters
    ).then(res => {
      setOriginalRoute(res.originalRoute);
      setAdaptedRoute(res.route);
      setActiveHazardAlert(prev => ({
        ...prev,
        rerouteResult: res,
      }));
    }).catch(err => console.warn('Initial reroute calculation fallback', err));
  }, [persona, surfaceFilters]);

  // Compute Initial Route Result
  const [currentRouteResult, setCurrentRouteResult] = useState<RouteResult>(() =>
    calculateAdaptedRoute(defaultReports)
  );

  const toggleHighContrast = () => setIsHighContrast(prev => !prev);
  const toggleVoicePrompt = () => {
    setIsVoicePromptActive(prev => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance("Voice navigation prompt enabled. Accessible guidance active.");
        window.speechSynthesis.speak(msg);
      }
      return next;
    });
  };

  const speakText = useCallback((text: string, force = false, onEnd?: () => void) => {
    if ((isVoicePromptActive || force) && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(text);
        msg.rate = 1.0;
        msg.pitch = 1.0;
        if (onEnd) {
          msg.onend = () => onEnd();
          msg.onerror = () => onEnd();
        }
        window.speechSynthesis.speak(msg);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
        if (onEnd) onEnd();
      }
    } else {
      if (onEnd) onEnd();
    }
  }, [isVoicePromptActive]);

  const acceptReroute = useCallback(() => {
    setActiveHazardAlert(prev => ({
      ...prev,
      isAccepted: true,
    }));
    speakText("Adapted route accepted. Navigating via South Ramp C bypass.");
  }, [speakText]);

  const recalculateCurrentRoute = useCallback(() => {
    const updated = calculateAdaptedRoute(
      simulatedObstacle.active ? barrierReports : barrierReports.filter(b => !b.title.includes('Elevator'))
    );
    setCurrentRouteResult(updated);
    return updated;
  }, [barrierReports, simulatedObstacle.active]);

  // Recalculate route automatically when barrier reports change or simulation toggles
  useEffect(() => {
    const newRoute = calculateAdaptedRoute(
      simulatedObstacle.active ? barrierReports : barrierReports.filter(b => !b.title.includes('Elevator'))
    );
    setCurrentRouteResult(newRoute);
  }, [barrierReports, simulatedObstacle.active]);

  // Seed default demo navigation session in registry if empty
  useEffect(() => {
    if (sessionRegistry.getAllActiveSessions().length === 0) {
      sessionRegistry.startSession({
        userId: 'nav-user-pilot-1',
        routeCoords: [
          { lat: 19.0760, lng: 72.8777 },
          { lat: 19.0770, lng: 72.8788 },
          { lat: 19.0780, lng: 72.8800 },
        ],
        estimatedMinutes: 6,
        alertCallback: (alert) => {
          console.log('[NavSession Alert Received]', alert);
        },
      });
    }
  }, []);

  // Setup Real-time Event Broadcaster & SSE Subscription
  useEffect(() => {
    // 1. In-memory broadcaster subscription
    const unsubscribe = barrierBroadcaster.subscribe(evt => {
      setRealtimeEvents(prev => [evt, ...prev.slice(0, 49)]); // Keep last 50 events

      // 1. ROUTE_RECALCULATED / REROUTE_EMITTED
      if ((evt.type === 'ROUTE_RECALCULATED' || evt.type === 'REROUTE_EMITTED') && evt.reroute) {
        setLastReroutePayload(evt.reroute);
        // Automatically sync adapted route into state
        recalculateCurrentRoute();
        speakText(`Route recalculated: avoids ${evt.reroute.hazardType}, saving ${evt.reroute.timeSaved} minutes.`);
      }

      // 2. BARRIER_AHEAD_ALERT
      if (evt.type === 'BARRIER_AHEAD_ALERT' && evt.barrierAhead) {
        speakText(`Warning: ${evt.barrierAhead.title} ahead in ${evt.barrierAhead.distanceAheadMeters} meters.`);
      }

      // 3. CONFIRMATION_PROMPT
      if (evt.type === 'CONFIRMATION_PROMPT' && evt.confirmationPrompt) {
        speakText(evt.confirmationPrompt.promptText);
      }
    });

    // 2. Connect client SSE stream if in browser
    realtimeClient.connect();

    return () => {
      unsubscribe();
      realtimeClient.disconnect();
    };
  }, [speakText, recalculateCurrentRoute]);

  // Setup Dynamic TTL Decay Tick Timer (runs every 10 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setBarrierReports(prev => tickBarrierDecay(prev));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Setup Offline Sync Listener
  useEffect(() => {
    offlineSyncManager.setFlushCallback(flushedReports => {
      flushedReports.forEach(rep => {
        addBarrierReport({
          title: rep.title,
          category: rep.category,
          severity: rep.severity,
          location: rep.location,
          description: rep.description,
          coordinates: rep.coordinates,
          roadLayer: rep.roadLayer,
        });
      });
      setOfflinePendingCount(0);
    });
  }, []);

  const toggleSimulatedObstacle = useCallback(() => {
    setActiveHazardAlert(prev => {
      const nextState = !prev.active;
      barrierBroadcaster.broadcast({
        type: 'ROUTE_RECALCULATED',
        message: nextState ? 'Obstacle simulation activated.' : 'Obstacle simulation cleared.',
      });
      return { ...prev, active: nextState, isAccepted: false };
    });
  }, []);

  const addBarrierReport = async (input: {
    title: string;
    category: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    location: string;
    microLocation?: string;
    estimatedResolutionTime?: string;
    affectsActiveRoute?: boolean;
    description?: string;
    roadLayer?: RoadLayer;
    coordinates?: { lat: number; lng: number };
  }): Promise<{ targetId: string; rerouteResult: RerouteResult }> => {
    // If offline, queue report locally
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      offlineSyncManager.enqueueReport({
        title: input.title,
        category: input.category,
        severity: input.severity || 'high',
        location: input.location,
        description: input.description || 'Offline submission.',
        coordinates: input.coordinates || { lat: 19.0760, lng: 72.8777 },
        roadLayer: input.roadLayer || 'at_grade',
      });
      setOfflinePendingCount(offlineSyncManager.getPendingQueue().length);
      speakText("Network connection spotty. Barrier report queued locally for sync.");
      const fallbackResult = await rerouteAroundBarrier(
        { lat: 19.0178, lng: 72.8430, name: 'Current GPS Location' },
        { lat: 19.0267, lng: 72.8375, name: 'Destination' },
        input,
        persona,
        surfaceFilters
      );
      return { targetId: 'offline-rep', rerouteResult: fallbackResult };
    }

    // 20-Meter Spatial Clustering Process
    const { updatedReports, merged, targetId } = processIncomingBarrierReport(barrierReports, input);
    setBarrierReports(updatedReports);

    const target = updatedReports.find(r => r.id === targetId);

    // Compute dynamic reroute around barrier
    const rerouteRes = await rerouteAroundBarrier(
      { lat: 19.0178, lng: 72.8430, name: 'Current GPS Position' },
      { lat: 19.0267, lng: 72.8375, name: 'Destination Concourse' },
      {
        ...input,
        coordinates: input.coordinates || target?.coordinates || { lat: 19.0220, lng: 72.8400 },
      },
      persona,
      surfaceFilters
    );

    setOriginalRoute(rerouteRes.originalRoute);
    setAdaptedRoute(rerouteRes.route);
    setNavigationStatus('rerouting');

    // Instant Rerouting Trigger:
    setActiveHazardAlert({
      active: true,
      title: input.title,
      location: input.location,
      microLocation: input.microLocation || input.location,
      detourTime: `+${rerouteRes.extraMinutes} min detour`,
      impact: `Active hazard reported. Bypassed with +${rerouteRes.extraMinutes} min detour (100% step-free).`,
      category: input.category,
      severity: input.severity || 'high',
      barrierReportId: targetId,
      originalRoute: rerouteRes.originalRoute.properties.label || `Original Route (Blocked by ${input.title})`,
      originalRouteDetail: input.description || `Hazard reported at ${input.location}. Route impassable for mobility profile.`,
      adaptedRoute: rerouteRes.route.properties.label || `Recommended Adapted Route (+${rerouteRes.extraMinutes} min detour)`,
      adaptedRouteDetail: `Dynamic bypass calculated avoiding ${input.category}. Verified step-free.`,
      rerouteResult: rerouteRes,
      isAccepted: false,
    });

    // ── Spatial Lookup: find all active navigating users affected ──
    if (target) {
      const layerMap: Record<string, RoadLayerType> = {
        flyover: RoadLayerType.FLYOVER,
        service_road: RoadLayerType.SERVICE_ROAD,
        at_grade: RoadLayerType.AT_GRADE,
      };
      getAffectedNavigatingUsers({
        barrierId: target.id,
        category: target.category,
        location: target.coordinates,
        roadLayer: layerMap[target.roadLayer] ?? RoadLayerType.AT_GRADE,
        confidenceScore: target.votes / (target.votes + target.downvotes + 1),
        radiusMeters: 300,
      });

      if (target.status === 'Verified' || target.severity === 'critical') {
        triggerActiveBarrierRecalculation(target, { activeBarriers: updatedReports, autoUpdateSession: true });
      }
    }

    if (merged) {
      barrierBroadcaster.broadcast({
        type: 'BARRIER_CONFIRMED',
        quadKey: target?.quadKey,
        barrier: target,
        message: `Barrier "${input.title}" re-confirmed within 20m cluster. TTL extended.`,
      });
      speakText("Duplicate barrier detected within 20 meters. Merged report & extended hazard duration.");
    } else {
      barrierBroadcaster.broadcast({
        type: 'BARRIER_REPORTED',
        quadKey: target?.quadKey,
        barrier: target,
        message: `New temporary barrier reported: ${input.title}`,
      });
      speakText(`Barrier reported. Rerouting. New route adds ${rerouteRes.extraMinutes} minutes and is fully step-free.`);
    }

    return { targetId, rerouteResult: rerouteRes };
  };

  const resolveReport = useCallback((id: string) => {
    setBarrierReports(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'Resolved' as const, isExpired: true, ttlSeconds: 0 } : r))
    );
    setActiveHazardAlert(prev => {
      if (prev.barrierReportId === id || prev.active) {
        return {
          ...prev,
          active: false,
          impact: 'Hazard marked resolved by community. Direct original route restored.',
        };
      }
      return prev;
    });
    setAdaptedRoute(null);
    setNavigationStatus('navigating');
    speakText("Barrier marked resolved by community. Direct original route restored.");
  }, [speakText]);

  const upvoteReport = (id: string) => {
    setBarrierReports(prev => {
      const next = upvoteBarrier(prev, id);
      const target = next.find(r => r.id === id);
      if (target) {
        barrierBroadcaster.broadcast({
          type: 'BARRIER_CONFIRMED',
          quadKey: target.quadKey,
          barrier: target,
          message: `Community verified barrier "${target.title}". TTL +30 min extension added.`,
        });
        speakText(`Upvoted barrier. Community confidence extended TTL by 30 minutes.`);

        if (target.status === 'Verified' || target.severity === 'critical') {
          triggerActiveBarrierRecalculation(target, { activeBarriers: next, autoUpdateSession: true });
          setActiveHazardAlert({
            active: true,
            title: target.title,
            location: target.location,
            microLocation: target.microLocation || target.location,
            detourTime: '+3 min detour',
            impact: `Community verified hazard on route (${target.votes} confirmations). Rerouting recommended.`,
            category: target.category,
            severity: target.severity,
            barrierReportId: target.id,
            originalRoute: `Original Route (Blocked by verified hazard: ${target.title})`,
            originalRouteDetail: target.description,
            adaptedRoute: `Recommended Adapted Route (Bypasses obstacle with +3 min detour)`,
            adaptedRouteDetail: `Step-free adapted route verified by community consensus.`,
            isAccepted: false,
          });
        }
      }
      return next;
    });
  };

  const downvoteReport = (id: string) => {
    setBarrierReports(prev => {
      const next = downvoteBarrier(prev, id);
      const target = next.find(r => r.id === id);
      if (target) {
        if (target.isExpired) {
          barrierBroadcaster.broadcast({
            type: 'BARRIER_EXPIRED',
            quadKey: target.quadKey,
            barrier: target,
            message: `Barrier "${target.title}" auto-expired due to community downvotes.`,
          });
          speakText(`Downvote threshold reached. Barrier auto-expired and cleared from route.`);
          setActiveHazardAlert(prev => (prev.barrierReportId === id ? { ...prev, active: false } : prev));
          setAdaptedRoute(null);
          setNavigationStatus('navigating');
        } else {
          barrierBroadcaster.broadcast({
            type: 'BARRIER_CONFIRMED',
            quadKey: target.quadKey,
            barrier: target,
            message: `Downvoted barrier "${target.title}". TTL reduced by 45 mins.`,
          });
          speakText(`Downvoted barrier. Hazard TTL reduced.`);
        }
      }
      return next;
    });
  };

  const triggerBarrierActivation = useCallback(async (barrierId: string) => {
    const target = barrierReports.find(b => b.id === barrierId);
    if (!target) return [];
    return triggerActiveBarrierRecalculation(target, { activeBarriers: barrierReports, autoUpdateSession: true });
  }, [barrierReports]);

  return (
    <AccessibilityContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        setDarkMode: setIsDarkMode,
        isNightMode: isDarkMode,
        toggleNightMode: toggleDarkMode,
        isHighContrast,
        toggleHighContrast,
        fontScale,
        setFontScale,
        isVoicePromptActive,
        toggleVoicePrompt,
        speakText,
        persona,
        setPersona,
        user,
        accessibilityPreferences,
        surfaceFilters,
        toggleSurfaceFilter,
        setSurfaceFilters,
        isOnboardingOpen,
        openOnboarding,
        closeOnboarding,
        loginUser,
        registerUser,
        logoutUser,
        saveAccessibilityProfile,
        simulatedObstacle: activeHazardAlert,
        activeHazardAlert,
        activeAlert: activeHazardAlert,
        navigationStatus,
        setNavigationStatus,
        originalRoute,
        adaptedRoute,
        toggleSimulatedObstacle,
        acceptReroute,
        barrierReports,
        addBarrierReport,
        upvoteReport,
        downvoteReport,
        resolveReport,
        currentRouteResult,
        recalculateCurrentRoute,
        realtimeEvents,
        offlinePendingCount,
        lastReroutePayload,
        triggerBarrierActivation,
      }}
    >
      <div
        className={`${isHighContrast ? 'high-contrast' : ''} ${isDarkMode ? 'dark dark-mode' : ''} font-scale-${fontScale} w-full min-h-screen transition-all`}
        data-theme={isDarkMode ? 'dark' : 'light'}
      >
        {children}
      </div>
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
}
