import { normalizeSupabaseUrl } from './supabase-url';

export interface SupabaseConfigValues {
  url: string;
  publishableKey: string;
  configured: boolean;
}

export function isSupabasePublishableKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const key = value.trim();
  if (!key) return false;

  // New Supabase browser-safe publishable key format.
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;

  // Legacy anon keys are JWTs. Only accept a JWT whose role is explicitly "anon".
  const parts = key.split('.');
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return payload?.role === 'anon';
  } catch {
    return false;
  }
}

export function resolveSupabaseConfig(
  build: { url?: string; publishableKey?: string },
  runtime: { url?: string; publishableKey?: string },
): SupabaseConfigValues {
  const url = normalizeSupabaseUrl(build.url?.trim() || runtime.url?.trim());
  const buildKey = isSupabasePublishableKey(build.publishableKey) ? build.publishableKey.trim() : '';
  const runtimeKey = isSupabasePublishableKey(runtime.publishableKey) ? runtime.publishableKey.trim() : '';
  const publishableKey = buildKey || runtimeKey;
  return { url, publishableKey, configured: Boolean(url && publishableKey) };
}

/**
 * CodeForge is a hosted-only app. Always send OAuth and email confirmation
 * callbacks to its canonical production origin, regardless of the page origin
 * or any query/hash values in the current browser URL.
 */
export const CODEFORGE_PRODUCTION_URL = 'https://codeforge-ide.vasudevaya.workers.dev/';

export function getSupabaseRedirectUrl(): string {
  return CODEFORGE_PRODUCTION_URL;
}

/** Use the PKCE authorization-code exchange instead of URL-fragment tokens. */
export function getSupabaseAuthOptions() {
  return {
    flowType: 'pkce' as const,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  };
}

/**
 * CodeForge is hosted-only. Prevent new auth sessions from being initiated on
 * localhost, where PKCE storage would be scoped to the wrong browser origin.
 * An OAuth callback already carrying a code is left on its original origin so
 * the verifier created by that same origin can be exchanged safely.
 */
export function getHostedAppRedirectUrl(currentHref: string): string | null {
  try {
    const current = new URL(currentHref);
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(current.hostname);
    if (!isLocalhost || current.searchParams.has('code')) return null;

    const production = new URL(CODEFORGE_PRODUCTION_URL);
    return new URL(
      `${current.pathname}${current.search}${current.hash}`,
      production,
    ).toString();
  } catch {
    return null;
  }
}
