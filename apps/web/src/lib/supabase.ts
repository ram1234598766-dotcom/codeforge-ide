import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfig = {
  url: supabaseUrl ?? '',
  publishableKey: publishableKey ?? '',
  configured: Boolean(supabaseUrl && publishableKey),
};

export const supabase = supabaseConfig.configured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase Auth is not configured. Set the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY build variables.');
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
