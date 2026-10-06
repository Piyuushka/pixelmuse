/**
 * pairingStore.ts
 *
 * Supabase-backed pairing logic with automatic fallback to the flat-file
 * userStore so the app keeps working during local dev without a DB.
 *
 * Supabase tables used:
 *   pairing_codes (id, dependent_id, code_hash, expires_at, used_at)
 *   caregiver_links (id, caregiver_id, dependent_id, status, consented_at)
 *   profiles (id, full_name, role)
 *
 * All codes are stored as SHA-256 hashes so the plaintext never hits the DB.
 */

import crypto from 'crypto';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import {
  findUserById,
  findUserByPairingCode,
  getValidPairingCode,
  refreshPairingCode,
  requestPairingByCode,
  respondToConsentRequest,
  getPendingConsentRequests,
} from '@/lib/db/userStore';

// In-memory cache for active plaintext codes so they survive component refreshes within TTL
const activePlaintextCodes = new Map<string, { code: string; expiresAt: string; codeHash: string }>();

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashCode(plain: string): string {
  // Normalise: digits only, lower-case — same on both sides
  const normalised = plain.replace(/\D/g, '');
  return crypto.createHash('sha256').update(normalised).digest('hex');
}

function generatePlainCode(): string {
  // 6-digit numeric code stored with a dash (e.g. "492817") shown as "492-817"
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedCode {
  code: string;      // plaintext 6-digit code shown to the user
  expiresAt: string; // ISO string
}

export interface PendingRequest {
  linkId: string;
  caregiverId: string;
  caregiverEmail: string;
  caregiverName: string;
  createdAt: string;
}

export interface DependentItem {
  id: string;
  name: string;
  email: string;
  status: string;
  lastPing?: string;
}

// ─── Generate pairing code (dependent side) ───────────────────────────────────

export async function generatePairingCode(dependentId: string, force: boolean = false): Promise<GeneratedCode> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured() || !isUUID(dependentId)) {
    // Fallback: flat-file store
    const user = findUserById(dependentId);
    if (!user) throw new Error('User not found');
    if (!force) {
      const existing = getValidPairingCode(user.email);
      if (existing) {
        return existing;
      }
    }
    const { code, expiresAt } = refreshPairingCode(user.email);
    return { code, expiresAt };
  }

  const now = new Date();

  // If not forcing a new code, check if we already have an unexpired cached code
  if (!force) {
    const cached = activePlaintextCodes.get(dependentId);
    if (cached && new Date(cached.expiresAt) > now) {
      // Check if it was marked as used in DB
      const { data: checkRow } = await supabase
        .from('pairing_codes')
        .select('id, used_at')
        .eq('dependent_id', dependentId)
        .eq('code_hash', cached.codeHash)
        .is('used_at', null)
        .gt('expires_at', now.toISOString())
        .maybeSingle();

      if (checkRow) {
        return { code: cached.code, expiresAt: cached.expiresAt };
      }
    }
  }

  // Invalidate existing unused codes for this dependent
  await supabase
    .from('pairing_codes')
    .update({ used_at: now.toISOString() })
    .eq('dependent_id', dependentId)
    .is('used_at', null);

  const plain = generatePlainCode();
  const code_hash = hashCode(plain);
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const { error } = await supabase.from('pairing_codes').insert({
    dependent_id: dependentId,
    code_hash,
    expires_at,
  });

  if (error) throw new Error(`Failed to store pairing code: ${error.message}`);

  activePlaintextCodes.set(dependentId, {
    code: plain,
    expiresAt: expires_at,
    codeHash: code_hash,
  });

  return { code: plain, expiresAt: expires_at };
}

// ─── Get current valid code for a dependent ───────────────────────────────────

export async function getCurrentCode(dependentId: string): Promise<{ code: string | null; expiresAt: string | null }> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured() || !isUUID(dependentId)) {
    const user = findUserById(dependentId);
    if (!user) return { code: null, expiresAt: null };
    const valid = getValidPairingCode(user.email);
    return { code: valid?.code || null, expiresAt: valid?.expiresAt || null };
  }

  const cached = activePlaintextCodes.get(dependentId);
  if (cached && new Date(cached.expiresAt) > new Date()) {
    return { code: cached.code, expiresAt: cached.expiresAt };
  }

  const { data } = await supabase
    .from('pairing_codes')
    .select('id, expires_at')
    .eq('dependent_id', dependentId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { code: null, expiresAt: null };
  return { code: null, expiresAt: data.expires_at };
}

// ─── Consent status (dependent side - PURE READ-ONLY) ─────────────────────────

export async function getConsentStatus(dependentId: string, email: string): Promise<{
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  pendingRequests: PendingRequest[];
  activeCaregiver: string | null;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured() || !isUUID(dependentId)) {
    const user = findUserById(dependentId);
    const pending = getPendingConsentRequests(email);
    const valid = user?.email ? getValidPairingCode(user.email) : null;
    return {
      pairingCode: valid?.code || null,
      pairingCodeExpiresAt: valid?.expiresAt || null,
      pendingRequests: pending.map((p: { linkId: string; guardianEmail: string; guardianName: string; createdAt: string }) => ({
        linkId: p.linkId,
        caregiverId: '',
        caregiverEmail: p.guardianEmail,
        caregiverName: p.guardianName,
        createdAt: p.createdAt,
      })),
      activeCaregiver: user?.linkedParentEmail || null,
    };
  }

  // Check cached unexpired code
  const cached = activePlaintextCodes.get(dependentId);
  let pairingCode: string | null = null;
  let pairingCodeExpiresAt: string | null = null;

  if (cached && new Date(cached.expiresAt) > new Date()) {
    pairingCode = cached.code;
    pairingCodeExpiresAt = cached.expiresAt;
  }

  // Get pending caregiver_links for this dependent
  const { data: pendingLinks } = await supabase
    .from('caregiver_links')
    .select('id, caregiver_id, created_at, profiles!caregiver_id(full_name, email)')
    .eq('dependent_id', dependentId)
    .eq('status', 'PENDING');

  const pendingRequests: PendingRequest[] = (pendingLinks || []).map((l: {
    id: string;
    caregiver_id: string;
    created_at: string;
    profiles?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[];
  }) => {
    const profile = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    return {
      linkId: l.id,
      caregiverId: l.caregiver_id,
      caregiverEmail: profile?.email || '',
      caregiverName: profile?.full_name || 'Unknown',
      createdAt: l.created_at,
    };
  });

  // Active caregiver (first ACTIVE link)
  const { data: activeLink } = await supabase
    .from('caregiver_links')
    .select('caregiver_id, profiles!caregiver_id(full_name, email)')
    .eq('dependent_id', dependentId)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();

  let activeCaregiver: string | null = null;
  if (activeLink) {
    const profile = Array.isArray(activeLink.profiles) ? activeLink.profiles[0] : activeLink.profiles;
    activeCaregiver = (profile as { full_name?: string; email?: string } | undefined)?.email || null;
  }

  return {
    pairingCode,
    pairingCodeExpiresAt,
    pendingRequests,
    activeCaregiver,
  };
}

// ─── Claim (caregiver side) ───────────────────────────────────────────────────

export async function claimPairingCode(caregiverId: string, caregiverEmail: string, plainCode: string): Promise<{
  linkId: string;
  status: string;
  dependent: { id: string; name: string; email: string };
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured() || !isUUID(caregiverId)) {
    const result = requestPairingByCode(caregiverEmail, plainCode);
    return {
      linkId: result.link.id,
      status: result.link.status,
      dependent: { id: result.dependent.email, name: result.dependent.name, email: result.dependent.email },
    };
  }

  const code_hash = hashCode(plainCode);
  const now = new Date().toISOString();

  // Look up the pairing code
  const { data: pairingRow, error: lookupErr } = await supabase
    .from('pairing_codes')
    .select('id, dependent_id, expires_at, used_at')
    .eq('code_hash', code_hash)
    .is('used_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lookupErr || !pairingRow) {
    throw new Error('Invalid or expired pairing code. Ask the dependent to generate a new one.');
  }

  if (pairingRow.dependent_id === caregiverId) {
    throw new Error('You cannot pair with your own account.');
  }

  // Get dependent profile
  const { data: dependentProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', pairingRow.dependent_id)
    .single();

  if (!dependentProfile) throw new Error('Dependent profile not found.');

  // Check for existing non-revoked link
  const { data: existingLink } = await supabase
    .from('caregiver_links')
    .select('id, status')
    .eq('caregiver_id', caregiverId)
    .eq('dependent_id', pairingRow.dependent_id)
    .neq('status', 'REVOKED')
    .limit(1)
    .single();

  if (existingLink) {
    return {
      linkId: existingLink.id,
      status: existingLink.status,
      dependent: {
        id: dependentProfile.id,
        name: dependentProfile.full_name,
        email: dependentProfile.email,
      },
    };
  }

  // Create PENDING link
  const { data: newLink, error: linkErr } = await supabase
    .from('caregiver_links')
    .insert({
      caregiver_id: caregiverId,
      dependent_id: pairingRow.dependent_id,
      status: 'PENDING',
    })
    .select('id, status')
    .single();

  if (linkErr || !newLink) {
    throw new Error(`Failed to create caregiver link: ${linkErr?.message}`);
  }

  // Mark code as used
  await supabase
    .from('pairing_codes')
    .update({ used_at: now })
    .eq('id', pairingRow.id);

  activePlaintextCodes.delete(pairingRow.dependent_id);

  return {
    linkId: newLink.id,
    status: newLink.status,
    dependent: {
      id: dependentProfile.id,
      name: dependentProfile.full_name,
      email: dependentProfile.email,
    },
  };
}

// ─── Consent response (dependent side) ───────────────────────────────────────

export async function respondToConsent(linkId: string, dependentId: string, accept: boolean): Promise<{ linkId: string; status: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured() || !isUUID(dependentId)) {
    // Fallback to flat-file store — we need dependent email
    const user = findUserById(dependentId);
    if (!user) throw new Error('User not found');
    const link = respondToConsentRequest(linkId, user.email, accept);
    return { linkId: link.id, status: link.status };
  }

  const newStatus = accept ? 'ACTIVE' : 'REVOKED';
  const { data, error } = await supabase
    .from('caregiver_links')
    .update({
      status: newStatus,
      consented_at: accept ? new Date().toISOString() : null,
    })
    .eq('id', linkId)
    .eq('dependent_id', dependentId) // security: dependent can only update their own links
    .select('id, status')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update consent');
  }

  return { linkId: data.id, status: data.status };
}

// ─── List dependents for a caregiver ─────────────────────────────────────────

export async function listDependents(caregiverId: string, caregiverEmail: string): Promise<DependentItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured() || !isUUID(caregiverId)) {
    const user = findUserById(caregiverId);
    if (!user) return [];
    return user.guardianLinks
      .filter((l) => l.status !== 'REVOKED' && l.guardianId === caregiverId)
      .map((l) => ({
        id: l.dependentId,
        name: l.dependentEmail,
        email: l.dependentEmail,
        status: l.status,
      }));
  }

  const { data, error } = await supabase
    .from('caregiver_links')
    .select('id, status, created_at, dependent_id, profiles!dependent_id(id, full_name, email)')
    .eq('caregiver_id', caregiverId)
    .neq('status', 'REVOKED')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row: {
    id: string;
    status: string;
    profiles?: { id?: string; full_name?: string; email?: string } | { id?: string; full_name?: string; email?: string }[];
  }) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: profile?.id || row.id,
      name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      status: row.status,
    };
  });
}

// ─── Revoke link ──────────────────────────────────────────────────────────────

export async function revokeLink(linkId: string, requesterId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured() || !isUUID(requesterId)) {
    // Flat-file fallback: not implemented here, handled elsewhere
    return;
  }

  await supabase
    .from('caregiver_links')
    .update({ status: 'REVOKED' })
    .eq('id', linkId)
    .or(`caregiver_id.eq.${requesterId},dependent_id.eq.${requesterId}`);
}
