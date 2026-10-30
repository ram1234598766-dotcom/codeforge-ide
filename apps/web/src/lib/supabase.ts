const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfig = {
  url: supabaseUrl ?? '',
  publishableKey: publishableKey ?? '',
  configured: Boolean(supabaseUrl && publishableKey),
};

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseConfig.configured) throw new Error('Supabase is not configured. Copy .env.example to .env.local.');
  const response = await fetch(`${supabaseConfig.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${supabaseConfig.publishableKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json();
}
