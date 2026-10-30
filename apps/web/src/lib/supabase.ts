import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig, type SupabaseConfigValues } from './supabase-config';

const buildConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
};

export let supabaseConfig: SupabaseConfigValues = resolveSupabaseConfig(buildConfig, {});
export let supabase: SupabaseClient | null = null;

function applySupabaseConfig(config: SupabaseConfigValues): void {
  supabaseConfig = config;
  supabase = config.configured
    ? createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
}

/**
 * Build-time Vite variables are preferred. When absent, fetch the browser-safe
 * configuration from the same-origin Worker endpoint before rendering the app.
 */
export async function initializeSupabase(): Promise<void> {
  let runtimeConfig: { url?: string; publishableKey?: string } = {};
  const initial = resolveSupabaseConfig(buildConfig, runtimeConfig);
  if (!initial.configured) {
    try {
      const response = await fetch('/api/config', { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json() as { url?: unknown; publishableKey?: unknown };
        runtimeConfig = {
          url: typeof payload.url === 'string' ? payload.url : undefined,
          publishableKey: typeof payload.publishableKey === 'string' ? payload.publishableKey : undefined,
        };
      }
    } catch {
      // Keep the app's explicit setup screen if runtime config cannot be reached.
    }
  }
  applySupabaseConfig(resolveSupabaseConfig(buildConfig, runtimeConfig));
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase Auth is not configured. Check the Worker runtime configuration at /api/config.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to continue.');
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + session.access_token,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error((payload as { error?: string } | null)?.error || 'CodeForge API request failed.');
  return payload as T;
}
