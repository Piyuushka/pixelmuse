import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pathfinder-dev-secret-change-in-production-32ch'
);

export const COOKIE_NAME = 'pf_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ─── TOKEN PAYLOAD ────────────────────────────────────────────────────────────

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: 'USER' | 'CAREGIVER' | 'ADMIN';
  name: string;
  onboarding_complete?: boolean;
}

// ─── SIGN ─────────────────────────────────────────────────────────────────────

export async function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// ─── VERIFY ───────────────────────────────────────────────────────────────────

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

// ─── COOKIE HELPERS (for use in API route handlers) ──────────────────────────

/**
 * Sets the session cookie on a NextResponse.
 * Call this from within an API route handler.
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Clears the session cookie on a NextResponse.
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

// ─── TOKEN FROM REQUEST ───────────────────────────────────────────────────────

/**
 * Reads the session token from a NextRequest cookie.
 * Returns null if not present.
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Reads and verifies the session from a NextRequest.
 * Returns the decoded payload, or null if invalid/absent.
 */
export async function getSessionFromRequest(request: NextRequest): Promise<TokenPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

// ─── SERVER COMPONENT HELPER ─────────────────────────────────────────────────

/**
 * Reads and verifies the session from server-side cookies() API.
 * For use in Server Components and Server Actions.
 */
export async function getServerSession(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
