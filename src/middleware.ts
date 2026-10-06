import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

// ─── ROUTE PROTECTION MAP ─────────────────────────────────────────────────────
//
// Patterns that require authentication (any role).
const PROTECTED_PATTERNS = [
  '/user',
  '/caregiver',
  '/caregiver-dashboard',
  '/caregiver-pairing',
  '/guardian-dashboard',
  '/guardian-settings',
  '/parent-dashboard',
  '/user-profile',
  '/user-sos',
  '/caregiver-app',
  '/api/pairing',
  '/api/location',
  '/api/sos',
  '/api/geofence',
  '/api/checkin',
  '/api/alerts',
  '/api/reports',
  '/api/parental/dashboard',
  '/api/parental/link',
  '/api/parental/settings',
  '/api/guardian',
];

// Patterns that are CAREGIVER-only (redirect USER away).
const CAREGIVER_ONLY_PATTERNS = [
  '/caregiver',
  '/caregiver-dashboard',
  '/caregiver-pairing',
  '/guardian-dashboard',
  '/guardian-settings',
  '/parent-dashboard',
  '/caregiver-app',
];

// Patterns that are USER-only (redirect CAREGIVER away).
const USER_ONLY_PATTERNS = [
  '/user',
  '/user-profile',
  '/user-sos',
];

// Public paths that should never be redirected.
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/landing',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/otp',
  '/api/auth/google',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PATTERNS.some(p => pathname.startsWith(p));
}

function isCaregiverOnly(pathname: string): boolean {
  return CAREGIVER_ONLY_PATTERNS.some(p => pathname.startsWith(p));
}

function isUserOnly(pathname: string): boolean {
  return USER_ONLY_PATTERNS.some(p => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths.
  if (isPublic(pathname)) return NextResponse.next();

  // Check if route needs protection.
  if (!isProtected(pathname)) return NextResponse.next();

  // Verify session.
  const session = await getSessionFromRequest(request);

  if (!session) {
    // Not authenticated → redirect to login with return URL.
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role guard — CAREGIVER-only routes.
  if (isCaregiverOnly(pathname) && session.role === 'USER') {
    // USER trying to access CAREGIVER page → send to their user map.
    return NextResponse.redirect(new URL('/user/map', request.url));
  }

  // Role guard — USER-only routes.
  if (isUserOnly(pathname) && session.role === 'CAREGIVER') {
    // CAREGIVER trying to access USER page → send to their caregiver map.
    return NextResponse.redirect(new URL('/caregiver/map', request.url));
  }

  // Inject session headers for downstream API routes (avoids re-parsing JWT).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-email', session.email);
  requestHeaders.set('x-user-role', session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Run on all paths except static files and Next.js internals.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
