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

export function isPublishableSupabaseKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const key = value.trim();
  if (!key) return false;

  // New Supabase browser-safe publishable key format.
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;

  // Legacy anon keys are JWTs. Only expose one whose role is explicitly "anon".
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
