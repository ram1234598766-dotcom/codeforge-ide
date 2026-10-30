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
