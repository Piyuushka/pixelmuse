/**
 * Supabase client — server-side (uses service role key).
 *
 * Only import this in API routes and server actions.
 * Never expose the service-role key to the browser.
 *
 * NOTE: If NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set,
 * the app falls back to the JSON flat-file userStore so the dev server still
 * works without a Supabase project during Phase 1 bring-up.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // No Supabase configured — callers must fall back to userStore.
    return null;
  }

  if (!_client) {
    _client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _client;
}

/**
 * Supabase client — browser-safe (anon key only).
 *
 * Import this in Client Components that need to interact with
 * Supabase realtime subscriptions or storage from the browser.
 */
let _browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  if (!_browserClient) {
    _browserClient = createClient(url, anonKey);
  }

  return _browserClient;
}

/** Returns true when Supabase env vars are configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
