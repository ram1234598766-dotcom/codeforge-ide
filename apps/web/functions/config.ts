import { isSupabasePublishableKey } from '../src/lib/supabase-config';

export interface SupabaseConfigBindings {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface PublicSupabaseConfig {
  url: string;
  publishableKey: string;
}

function normalizeProjectUrl(value: string | undefined): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  return trimmed.replace(/\/rest\/v1$/i, '');
}

// Preserve the Worker configuration API while sharing validation with the browser.
export const isPublishableSupabaseKey = isSupabasePublishableKey;

export function getPublicSupabaseConfig(env: SupabaseConfigBindings): PublicSupabaseConfig | null {
  const url = normalizeProjectUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url || !isPublishableSupabaseKey(publishableKey)) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  } catch {
    return null;
  }

  return { url, publishableKey };
}
