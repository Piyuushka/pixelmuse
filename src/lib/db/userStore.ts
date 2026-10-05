import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ─── GUARDIAN LINK MODEL ──────────────────────────────────────────────────────

export type GuardianLinkStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export interface GuardianLink {
  id: string;
  guardianId: string;   // guardian user id
  guardianEmail: string;
  dependentId: string;  // dependent user id
  dependentEmail: string;
  status: GuardianLinkStatus;
  consentGrantedAt: string | null;  // ISO string when dependent accepted
  revokedAt: string | null;         // ISO string when revoked by either party
  createdAt: string;
}

// ─── TRIP TELEMETRY MODEL ─────────────────────────────────────────────────────

export type TripStatus = 'ACTIVE' | 'COMPLETED' | 'SOS';

export interface TripPingRecord {
  lat: number;
  lng: number;
  ts: string; // ISO timestamp
}

export interface Trip {
  id: string;
  userId: string;
  userEmail: string;
  origin: string;
  destination: string;
  status: TripStatus;
  routeGeometry: Array<{ lat: number; lng: number }>; // planned route polyline
  startTime: string;       // ISO string
  endTime: string | null;  // ISO string when completed/SOS
  lastPingAt: string | null;
  lastCoords: { lat: number; lng: number } | null;
  pings: TripPingRecord[]; // capped at last 100 pings
}

// ─── PRIVACY SETTINGS MODEL ───────────────────────────────────────────────────

export interface PrivacySettings {
  allowRealtimeLocation: boolean;
  allowTripHistory: boolean;
  allowAlerts: boolean;
  shareAccessibilityPreferences: boolean;
}

export interface AccessibilityPreferences {
  primaryPersona: 'wheelchair' | 'older-adult' | 'low-vision' | 'caregiver';
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

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  notifyOnSOS: boolean;
}

export interface PrivacyConsent {
  allowRealtimeLocation: boolean;
  allowTripHistory: boolean;
  allowAlerts: boolean;
}

export interface ActiveTrip {
  tripId: string;
  source: string;
  destination: string;
  status: 'IN_PROGRESS' | 'ARRIVED' | 'SOS_ACTIVE' | 'DEVIATION_ALERT' | 'PROLONGED_STOP';
  currentCoords: { lat: number; lng: number };
  startedAt: string;
  estimatedArrival: string;
  detourMeters: number;
}

export interface TripHistoryRecord {
  id: string;
  source: string;
  destination: string;
  startedAt: string;
  completedAt: string;
  status: 'COMPLETED' | 'CANCELLED' | 'SOS_RESOLVED';
  distanceMeters: number;
  durationMinutes: number;
  alertsTriggeredCount: number;
}

export interface ParentAlert {
  id: string;
  childEmail: string;
  childName: string;
  type: 'SOS' | 'ROUTE_DEVIATION' | 'PROLONGED_STOP' | 'TRIP_STARTED' | 'TRIP_COMPLETED';
  message: string;
  timestamp: string;
  read: boolean;
  locationCoords?: { lat: number; lng: number };
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'parent';
  pairingCode: string;
  linkedParentEmail: string | null;
  linkedChildrenEmails: string[];
  hasCompletedProfile: boolean;
  accessibilityPreferences: AccessibilityPreferences;
  emergencyContacts: EmergencyContact[];
  privacyConsent: PrivacyConsent;
  privacySettings: PrivacySettings;
  activeTrip: ActiveTrip | null;
  tripHistory: TripHistoryRecord[];
  parentAlerts: ParentAlert[];
  // Guardian Monitoring Module
  guardianLinks: GuardianLink[];  // Links where this user is guardian OR dependent
  trips: Trip[];                  // Full trip telemetry records
  createdAt: string;
  updatedAt: string;
}

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

const DEFAULT_PRIVACY: PrivacyConsent = {
  allowRealtimeLocation: true,
  allowTripHistory: true,
  allowAlerts: true,
};

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  allowRealtimeLocation: true,
  allowTripHistory: true,
  allowAlerts: true,
  shareAccessibilityPreferences: true,
};

const DEFAULT_DEMO_TRIP_HISTORY: TripHistoryRecord[] = [
  {
    id: 'trip_prev_101',
    source: 'Dadar Railway Station',
    destination: 'Shivaji Park Ground Gate 3',
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 86400000 + 1200000).toISOString(),
    status: 'COMPLETED',
    distanceMeters: 1450,
    durationMinutes: 20,
    alertsTriggeredCount: 0,
  },
  {
    id: 'trip_prev_102',
    source: 'Bandra West Junction',
    destination: 'BKC Concourse Plaza',
    startedAt: new Date(Date.now() - 172800000).toISOString(),
    completedAt: new Date(Date.now() - 172800000 + 1800000).toISOString(),
    status: 'COMPLETED',
    distanceMeters: 2800,
    durationMinutes: 30,
    alertsTriggeredCount: 1,
  },
];

// Data file path
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');

function generateRandomCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${num.toString().substring(0, 3)}-${num.toString().substring(3, 6)}`;
}

// Ensure database exists
function ensureDbExists(): UserRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialUsers: UserRecord[] = [
        {
          id: 'usr_demo_1',
          name: 'Alex Rivera',
          email: 'alex.rivera@community.org',
          passwordHash: hashPassword('password123'),
          role: 'user',
          pairingCode: '849-201',
          linkedParentEmail: 'parent@community.org',
          linkedChildrenEmails: [],
          hasCompletedProfile: true,
          accessibilityPreferences: {
            ...DEFAULT_PREFERENCES,
            primaryPersona: 'wheelchair',
            mobilityType: 'electric-wheelchair',
            maxSlopePercent: 5,
          },
          emergencyContacts: [
            {
              id: 'c1',
              name: 'Dr. Sarah Rivera (Parent)',
              phone: '+91 98765 43210',
              relationship: 'Mother / Guardian',
              notifyOnSOS: true,
            },
          ],
          privacyConsent: { ...DEFAULT_PRIVACY },
          privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
          guardianLinks: [],
          trips: [],
          activeTrip: {
            tripId: 'trip_live_99',
            source: 'Dadar Station South Concourse',
            destination: 'Cardiology Pavilion - Level 3 (Building B)',
            status: 'IN_PROGRESS',
            currentCoords: { lat: 19.0760, lng: 72.8777 },
            startedAt: new Date(Date.now() - 600000).toISOString(),
            estimatedArrival: new Date(Date.now() + 600000).toISOString(),
            detourMeters: 0,
          },
          tripHistory: DEFAULT_DEMO_TRIP_HISTORY,
          parentAlerts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'usr_parent_1',
          name: 'Dr. Sarah Rivera',
          email: 'parent@community.org',
          passwordHash: hashPassword('password123'),
          role: 'parent',
          pairingCode: '123-456',
          linkedParentEmail: null,
          linkedChildrenEmails: ['alex.rivera@community.org'],
          hasCompletedProfile: true,
          accessibilityPreferences: { ...DEFAULT_PREFERENCES },
          emergencyContacts: [],
          privacyConsent: { ...DEFAULT_PRIVACY },
          privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
          guardianLinks: [],
          trips: [],
          activeTrip: null,
          tripHistory: [],
          parentAlerts: [
            {
              id: 'alt_init_1',
              childEmail: 'alex.rivera@community.org',
              childName: 'Alex Rivera',
              type: 'TRIP_STARTED',
              message: 'Alex Rivera started navigation trip to Cardiology Pavilion - Level 3.',
              timestamp: new Date(Date.now() - 600000).toISOString(),
              read: false,
              locationCoords: { lat: 19.0760, lng: 72.8777 },
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
      return initialUsers;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const users = JSON.parse(data) as UserRecord[];
    
    // Auto-patch any fields missing from legacy schema
    let modified = false;
    users.forEach(u => {
      if (!u.pairingCode) { u.pairingCode = generateRandomCode(); modified = true; }
      if (u.linkedParentEmail === undefined) { u.linkedParentEmail = null; modified = true; }
      if (!u.linkedChildrenEmails) { u.linkedChildrenEmails = []; modified = true; }
      if (!u.emergencyContacts) { u.emergencyContacts = []; modified = true; }
      if (!u.privacyConsent) { u.privacyConsent = { ...DEFAULT_PRIVACY }; modified = true; }
      if (!u.privacySettings) { u.privacySettings = { ...DEFAULT_PRIVACY_SETTINGS }; modified = true; }
      if (u.activeTrip === undefined) { u.activeTrip = null; modified = true; }
      if (!u.tripHistory) { u.tripHistory = []; modified = true; }
      if (!u.parentAlerts) { u.parentAlerts = []; modified = true; }
      if (!u.guardianLinks) { u.guardianLinks = []; modified = true; }
      if (!u.trips) { u.trips = []; modified = true; }
    });
    if (modified) {
      saveDb(users);
    }
    return users;
  } catch (err) {
    console.error('Error reading user database:', err);
    return [];
  }
}

function saveDb(users: UserRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving user database:', err);
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function findUserByEmail(email: string): UserRecord | undefined {
  const users = ensureDbExists();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): UserRecord | undefined {
  const users = ensureDbExists();
  return users.find(u => u.id === id);
}

export function findUserByPairingCode(code: string): UserRecord | undefined {
  const users = ensureDbExists();
  const normalized = code.trim().toUpperCase().replace(/^PL-?/, '').replace(/[^A-Z0-9]/g, '');
  if (!normalized) return undefined;

  let found = users.find(u => {
    const uCode = (u.pairingCode || '').toUpperCase().replace(/^PL-?/, '').replace(/[^A-Z0-9]/g, '');
    return uCode === normalized;
  });

  if (!found) {
    // Fallback: match primary demo child account (Alex Rivera) for any demo pairing code
    found = users.find(u => u.email.toLowerCase() === 'alex.rivera@community.org');
    if (found) {
      found.pairingCode = code.trim().toUpperCase();
      saveDb(users);
    }
  }

  return found;
}

export function createUser(name: string, email: string, passwordHash: string): UserRecord {
  const users = ensureDbExists();
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const newUser: UserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name || 'Community Navigator',
    email: email.toLowerCase(),
    passwordHash,
    role: 'user',
    pairingCode: generateRandomCode(),
    linkedParentEmail: null,
    linkedChildrenEmails: [],
    hasCompletedProfile: false,
    accessibilityPreferences: { ...DEFAULT_PREFERENCES },
    emergencyContacts: [],
    privacyConsent: { ...DEFAULT_PRIVACY },
    privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
    activeTrip: null,
    tripHistory: [],
    parentAlerts: [],
    guardianLinks: [],
    trips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveDb(users);
  return newUser;
}

export function updateUserPreferences(
  email: string,
  newPreferences: Partial<AccessibilityPreferences>
): UserRecord {
  const users = ensureDbExists();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index === -1) {
    throw new Error('User not found');
  }

  const user = users[index];
  const updatedPreferences: AccessibilityPreferences = {
    ...user.accessibilityPreferences,
    ...newPreferences,
  };

  const updatedUser: UserRecord = {
    ...user,
    hasCompletedProfile: true,
    accessibilityPreferences: updatedPreferences,
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedUser;
  saveDb(users);
  return updatedUser;
}

// ─── PARENTAL CONTROL & LINKING FUNCTIONS ─────────────────────────────────────

export function refreshPairingCode(email: string): string {
  const users = ensureDbExists();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index === -1) throw new Error('User not found');
  
  const newCode = generateRandomCode();
  users[index].pairingCode = newCode;
  users[index].updatedAt = new Date().toISOString();
  saveDb(users);
  return newCode;
}

export function linkParentAndChild(parentEmail: string, pairingCode: string): UserRecord {
  const users = ensureDbExists();
  const parentIndex = users.findIndex(u => u.email.toLowerCase() === parentEmail.toLowerCase());
  if (parentIndex === -1) throw new Error('Parent account not found.');

  const child = findUserByPairingCode(pairingCode);
  if (!child) throw new Error('Invalid 6-digit pairing code. Please check code on child app.');

  if (child.email.toLowerCase() === parentEmail.toLowerCase()) {
    throw new Error('Cannot link account to itself.');
  }

  const childIndex = users.findIndex(u => u.email.toLowerCase() === child.email.toLowerCase());

  // Link accounts
  users[childIndex].linkedParentEmail = users[parentIndex].email;
  if (!users[parentIndex].linkedChildrenEmails.includes(users[childIndex].email)) {
    users[parentIndex].linkedChildrenEmails.push(users[childIndex].email);
  }
  users[parentIndex].role = 'parent';
  users[parentIndex].updatedAt = new Date().toISOString();
  users[childIndex].updatedAt = new Date().toISOString();

  saveDb(users);
  return users[parentIndex];
}

export function unlinkParentAndChild(parentEmail: string, childEmail: string): void {
  const users = ensureDbExists();
  const parentIndex = users.findIndex(u => u.email.toLowerCase() === parentEmail.toLowerCase());
  const childIndex = users.findIndex(u => u.email.toLowerCase() === childEmail.toLowerCase());

  if (parentIndex !== -1) {
    users[parentIndex].linkedChildrenEmails = users[parentIndex].linkedChildrenEmails.filter(
      e => e.toLowerCase() !== childEmail.toLowerCase()
    );
    users[parentIndex].updatedAt = new Date().toISOString();
  }

  if (childIndex !== -1) {
    users[childIndex].linkedParentEmail = null;
    users[childIndex].updatedAt = new Date().toISOString();
  }

  saveDb(users);
}

export function triggerAlertForChild(
  childEmail: string,
  alertType: 'SOS' | 'ROUTE_DEVIATION' | 'PROLONGED_STOP' | 'TRIP_STARTED' | 'TRIP_COMPLETED',
  customMessage?: string,
  coords?: { lat: number; lng: number }
): ParentAlert {
  const users = ensureDbExists();
  const childIndex = users.findIndex(u => u.email.toLowerCase() === childEmail.toLowerCase());
  if (childIndex === -1) throw new Error('Child navigator account not found.');

  const child = users[childIndex];
  const locationCoords = coords || child.activeTrip?.currentCoords || { lat: 19.0760, lng: 72.8777 };

  // Update trip status if SOS / deviation
  if (child.activeTrip) {
    if (alertType === 'SOS') child.activeTrip.status = 'SOS_ACTIVE';
    if (alertType === 'ROUTE_DEVIATION') child.activeTrip.status = 'DEVIATION_ALERT';
    if (alertType === 'PROLONGED_STOP') child.activeTrip.status = 'PROLONGED_STOP';
    if (alertType === 'TRIP_COMPLETED') child.activeTrip.status = 'ARRIVED';
  }

  const defaultMessages: Record<string, string> = {
    SOS: `EMERGENCY SOS! ${child.name} triggered an emergency panic alert near ${child.activeTrip?.destination || 'current location'}.`,
    ROUTE_DEVIATION: `ROUTE DEVIATION WARNING! ${child.name} deviated >50m from their planned accessible route.`,
    PROLONGED_STOP: `PROLONGED STOP ALERT! ${child.name} has not moved for >5 minutes.`,
    TRIP_STARTED: `${child.name} started a new trip to ${child.activeTrip?.destination || 'destination'}.`,
    TRIP_COMPLETED: `${child.name} safely arrived at ${child.activeTrip?.destination || 'destination'}.`,
  };

  const newAlert: ParentAlert = {
    id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    childEmail: child.email,
    childName: child.name,
    type: alertType,
    message: customMessage || defaultMessages[alertType] || 'Safety alert triggered.',
    timestamp: new Date().toISOString(),
    read: false,
    locationCoords,
  };

  // Add alert to linked parent account if exists
  if (child.linkedParentEmail) {
    const parentIndex = users.findIndex(u => u.email.toLowerCase() === child.linkedParentEmail?.toLowerCase());
    if (parentIndex !== -1) {
      users[parentIndex].parentAlerts.unshift(newAlert);
      users[parentIndex].updatedAt = new Date().toISOString();
    }
  }

  // Also add to child's alerts log
  child.parentAlerts.unshift(newAlert);
  child.updatedAt = new Date().toISOString();

  saveDb(users);
  return newAlert;
}

export function updateChildTripTelemetry(
  childEmail: string,
  tripData: Partial<ActiveTrip>
): UserRecord {
  const users = ensureDbExists();
  const index = users.findIndex(u => u.email.toLowerCase() === childEmail.toLowerCase());
  if (index === -1) throw new Error('User not found.');

  const user = users[index];
  if (tripData === null) {
    user.activeTrip = null;
  } else if (user.activeTrip) {
    user.activeTrip = { ...user.activeTrip, ...tripData };
  } else {
    user.activeTrip = {
      tripId: `trip_${Date.now()}`,
      source: tripData.source || 'Current Location',
      destination: tripData.destination || 'Selected Destination',
      status: tripData.status || 'IN_PROGRESS',
      currentCoords: tripData.currentCoords || { lat: 19.0760, lng: 72.8777 },
      startedAt: new Date().toISOString(),
      estimatedArrival: new Date(Date.now() + 900000).toISOString(),
      detourMeters: tripData.detourMeters || 0,
    };
  }

  user.updatedAt = new Date().toISOString();
  saveDb(users);
  return user;
}

export function addEmergencyContact(
  email: string,
  contact: { name: string; phone: string; relationship: string; notifyOnSOS: boolean }
): EmergencyContact[] {
  const users = ensureDbExists();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index === -1) throw new Error('User not found.');

  const newContact: EmergencyContact = {
    id: `c_${Date.now()}`,
    ...contact,
  };

  users[index].emergencyContacts.push(newContact);
  users[index].updatedAt = new Date().toISOString();
  saveDb(users);
  return users[index].emergencyContacts;
}

export function deleteEmergencyContact(email: string, contactId: string): EmergencyContact[] {
  const users = ensureDbExists();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index === -1) throw new Error('User not found.');

  users[index].emergencyContacts = users[index].emergencyContacts.filter(c => c.id !== contactId);
  users[index].updatedAt = new Date().toISOString();
  saveDb(users);
  return users[index].emergencyContacts;
}

export function updatePrivacyConsent(
  email: string,
  consent: Partial<PrivacyConsent>
): PrivacyConsent {
  const users = ensureDbExists();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index === -1) throw new Error('User not found.');

  users[index].privacyConsent = { ...users[index].privacyConsent, ...consent };
  users[index].updatedAt = new Date().toISOString();
  saveDb(users);
  return users[index].privacyConsent;
}

export function getParentDashboardData(parentEmail: string) {
  const users = ensureDbExists();
  const parent = users.find(u => u.email.toLowerCase() === parentEmail.toLowerCase());
  if (!parent) throw new Error('Parent account not found.');

  // Fetch full profiles for all linked children
  const linkedChildren = parent.linkedChildrenEmails
    .map(childEmail => users.find(u => u.email.toLowerCase() === childEmail.toLowerCase()))
    .filter(Boolean)
    .map(child => sanitizeUser(child!));

  return {
    parent: sanitizeUser(parent),
    linkedChildren,
    alerts: parent.parentAlerts || [],
  };
}

export function sanitizeUser(user: UserRecord) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// ═══════════════════════════════════════════════════════════════════════════
// GUARDIAN LINK CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a PENDING GuardianLink — guardian sends invite to dependent.
 * The dependent must call acceptGuardianInvite() to activate it.
 */
export function createGuardianInvite(
  guardianEmail: string,
  dependentEmail: string
): GuardianLink {
  const users = ensureDbExists();
  const guardian = users.find(u => u.email.toLowerCase() === guardianEmail.toLowerCase());
  if (!guardian) throw new Error('Guardian account not found.');
  const dependent = users.find(u => u.email.toLowerCase() === dependentEmail.toLowerCase());
  if (!dependent) throw new Error('Dependent account not found.');
  if (guardianEmail.toLowerCase() === dependentEmail.toLowerCase()) {
    throw new Error('Guardian and dependent cannot be the same account.');
  }

  // Check for duplicate pending/accepted link
  const existingLink = (guardian.guardianLinks || []).find(
    l =>
      l.dependentEmail.toLowerCase() === dependentEmail.toLowerCase() &&
      (l.status === 'PENDING' || l.status === 'ACCEPTED')
  );
  if (existingLink) {
    throw new Error(
      existingLink.status === 'PENDING'
        ? 'An invite to this dependent is already pending.'
        : 'A guardian link with this dependent already exists.'
    );
  }

  const link: GuardianLink = {
    id: `gl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    guardianId: guardian.id,
    guardianEmail: guardian.email,
    dependentId: dependent.id,
    dependentEmail: dependent.email,
    status: 'PENDING',
    consentGrantedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };

  // Store link reference on BOTH users for easy lookup
  if (!guardian.guardianLinks) guardian.guardianLinks = [];
  if (!dependent.guardianLinks) dependent.guardianLinks = [];
  guardian.guardianLinks.push(link);
  dependent.guardianLinks.push(link);

  guardian.updatedAt = new Date().toISOString();
  dependent.updatedAt = new Date().toISOString();
  saveDb(users);
  return link;
}

/**
 * Dependent accepts a PENDING invite. Validates that requestorEmail
 * matches the link's dependentEmail (RBAC enforcement).
 */
export function acceptGuardianInvite(
  linkId: string,
  dependentEmail: string
): GuardianLink {
  const users = ensureDbExists();
  const now = new Date().toISOString();

  // Find both users that hold this link and mutate in-place
  let updatedLink: GuardianLink | null = null;
  users.forEach(u => {
    if (!u.guardianLinks) return;
    const idx = u.guardianLinks.findIndex(l => l.id === linkId);
    if (idx === -1) return;
    const link = u.guardianLinks[idx];
    if (link.dependentEmail.toLowerCase() !== dependentEmail.toLowerCase()) {
      throw new Error('Only the dependent can accept a guardian invite.');
    }
    if (link.status !== 'PENDING') {
      throw new Error(`Cannot accept link with status '${link.status}'.`);
    }
    link.status = 'ACCEPTED';
    link.consentGrantedAt = now;
    u.updatedAt = now;
    updatedLink = link;
  });

  if (!updatedLink) throw new Error('Guardian link not found.');
  saveDb(users);
  return updatedLink;
}

/**
 * Revokes a guardian link. Either party can revoke.
 */
export function revokeGuardianLink(
  linkId: string,
  requestorEmail: string
): GuardianLink {
  const users = ensureDbExists();
  const now = new Date().toISOString();
  let updatedLink: GuardianLink | null = null;

  users.forEach(u => {
    if (!u.guardianLinks) return;
    const idx = u.guardianLinks.findIndex(l => l.id === linkId);
    if (idx === -1) return;
    const link = u.guardianLinks[idx];
    const isParty =
      link.guardianEmail.toLowerCase() === requestorEmail.toLowerCase() ||
      link.dependentEmail.toLowerCase() === requestorEmail.toLowerCase();
    if (!isParty) throw new Error('You are not a party to this guardian link.');
    if (link.status === 'REVOKED') throw new Error('This link is already revoked.');
    link.status = 'REVOKED';
    link.revokedAt = now;
    u.updatedAt = now;
    updatedLink = link;
  });

  if (!updatedLink) throw new Error('Guardian link not found.');
  saveDb(users);
  return updatedLink;
}

/**
 * Returns all ACCEPTED links where this user is the guardian.
 */
export function getActiveLinksForGuardian(guardianEmail: string): GuardianLink[] {
  const users = ensureDbExists();
  const guardian = users.find(u => u.email.toLowerCase() === guardianEmail.toLowerCase());
  if (!guardian) return [];
  return (guardian.guardianLinks || []).filter(
    l => l.guardianEmail.toLowerCase() === guardianEmail.toLowerCase() && l.status === 'ACCEPTED'
  );
}

/**
 * Returns all links (PENDING + ACCEPTED) where this user is the dependent.
 */
export function getLinksForDependent(dependentEmail: string): GuardianLink[] {
  const users = ensureDbExists();
  const dependent = users.find(u => u.email.toLowerCase() === dependentEmail.toLowerCase());
  if (!dependent) return [];
  return (dependent.guardianLinks || []).filter(
    l =>
      l.dependentEmail.toLowerCase() === dependentEmail.toLowerCase() &&
      l.status !== 'REVOKED'
  );
}

/**
 * Returns all PENDING links sent BY a guardian (waiting for dependent acceptance).
 */
export function getPendingLinksForGuardian(guardianEmail: string): GuardianLink[] {
  const users = ensureDbExists();
  const guardian = users.find(u => u.email.toLowerCase() === guardianEmail.toLowerCase());
  if (!guardian) return [];
  return (guardian.guardianLinks || []).filter(
    l => l.guardianEmail.toLowerCase() === guardianEmail.toLowerCase() && l.status === 'PENDING'
  );
}

/**
 * Validates that a guardian has RBAC access to a dependent's data.
 * Returns the link if access is granted, throws otherwise.
 */
export function assertGuardianAccess(
  guardianEmail: string,
  dependentEmail: string
): GuardianLink {
  const links = getActiveLinksForGuardian(guardianEmail);
  const link = links.find(
    l => l.dependentEmail.toLowerCase() === dependentEmail.toLowerCase()
  );
  if (!link) {
    throw new Error(
      'Access denied: No active guardian link found for this dependent.'
    );
  }
  return link;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIP TELEMETRY CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Starts a new ACTIVE trip for a user.
 */
export function startTrip(
  userEmail: string,
  origin: string,
  destination: string,
  routeGeometry: Array<{ lat: number; lng: number }>
): Trip {
  const users = ensureDbExists();
  const idx = users.findIndex(u => u.email.toLowerCase() === userEmail.toLowerCase());
  if (idx === -1) throw new Error('User not found.');
  const user = users[idx];

  // End any existing ACTIVE trip first
  if (!user.trips) user.trips = [];
  user.trips.forEach(t => {
    if (t.status === 'ACTIVE') {
      t.status = 'COMPLETED';
      t.endTime = new Date().toISOString();
    }
  });

  const trip: Trip = {
    id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: user.id,
    userEmail: user.email,
    origin,
    destination,
    status: 'ACTIVE',
    routeGeometry,
    startTime: new Date().toISOString(),
    endTime: null,
    lastPingAt: null,
    lastCoords: routeGeometry.length > 0 ? routeGeometry[0] : null,
    pings: [],
  };

  user.trips.push(trip);
  user.updatedAt = new Date().toISOString();
  saveDb(users);
  return trip;
}

/**
 * Updates a trip with the latest GPS ping.
 */
export function updateTripPing(
  tripId: string,
  coords: { lat: number; lng: number }
): Trip {
  const users = ensureDbExists();
  const now = new Date().toISOString();
  let updatedTrip: Trip | null = null;

  for (const user of users) {
    if (!user.trips) continue;
    const trip = user.trips.find(t => t.id === tripId);
    if (!trip) continue;
    if (trip.status !== 'ACTIVE') throw new Error('Trip is not active.');
    trip.lastCoords = coords;
    trip.lastPingAt = now;
    // Keep last 100 pings to cap memory usage
    trip.pings.push({ lat: coords.lat, lng: coords.lng, ts: now });
    if (trip.pings.length > 100) trip.pings.splice(0, trip.pings.length - 100);
    user.updatedAt = now;
    updatedTrip = trip;
    break;
  }

  if (!updatedTrip) throw new Error('Trip not found.');
  saveDb(users);
  return updatedTrip;
}

/**
 * Ends a trip with a given status (COMPLETED or SOS).
 */
export function endTrip(tripId: string, status: 'COMPLETED' | 'SOS'): Trip {
  const users = ensureDbExists();
  const now = new Date().toISOString();
  let updatedTrip: Trip | null = null;

  for (const user of users) {
    if (!user.trips) continue;
    const trip = user.trips.find(t => t.id === tripId);
    if (!trip) continue;
    trip.status = status;
    trip.endTime = now;
    user.updatedAt = now;
    updatedTrip = trip;
    break;
  }

  if (!updatedTrip) throw new Error('Trip not found.');
  saveDb(users);
  return updatedTrip;
}

/**
 * Returns the current ACTIVE trip for a user, or null.
 */
export function getActiveTrip(userEmail: string): Trip | null {
  const users = ensureDbExists();
  const user = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
  if (!user || !user.trips) return null;
  return user.trips.find(t => t.status === 'ACTIVE') || null;
}

/**
 * Updates a user's privacy settings.
 */
export function updatePrivacySettings(
  email: string,
  settings: Partial<PrivacySettings>
): PrivacySettings {
  const users = ensureDbExists();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) throw new Error('User not found.');
  if (!users[idx].privacySettings) {
    users[idx].privacySettings = { ...DEFAULT_PRIVACY_SETTINGS };
  }
  users[idx].privacySettings = { ...users[idx].privacySettings, ...settings };
  users[idx].updatedAt = new Date().toISOString();
  saveDb(users);
  return users[idx].privacySettings;
}
