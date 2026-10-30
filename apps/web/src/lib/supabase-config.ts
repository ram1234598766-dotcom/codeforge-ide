import { normalizeSupabaseUrl } from './supabase-url';

export interface SupabaseConfigValues {
  url: string;
  publishableKey: string;
  configured: boolean;
}

export function resolveSupabaseConfig(
  build: { url?: string; publishableKey?: string },
  runtime: { url?: string; publishableKey?: string },
): SupabaseConfigValues {
  const url = normalizeSupabaseUrl(build.url?.trim() || runtime.url?.trim());
  const publishableKey = build.publishableKey?.trim() || runtime.publishableKey?.trim() || '';
  return { url, publishableKey, configured: Boolean(url && publishableKey) };
}

/**
 * Normalize auth callbacks to the app origin. Dropping query/hash values prevents
 * stale OAuth parameters from being carried into a subsequent login attempt.
 */
export function getSupabaseRedirectUrl(currentUrl: string): string {
  const url = new URL(currentUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Supabase redirects require an HTTP(S) application URL.');
  }
  return url.origin;
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
