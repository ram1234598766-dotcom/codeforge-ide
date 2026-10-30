import { supabaseConfig } from './supabase';

// D1 Database binding access (Available in Pages Functions context)
// For static frontend, we'll provide a helper that can be used in Pages Functions
export type D1Database = any; // In production, this is Cloudflare D1 binding
export type KVNamespace = any; // In production, this is Cloudflare KV binding

export async function getD1Database(env: { CODEFORGE_DB?: D1Database }): Promise<D1Database> {
  if (!env.CODEFORGE_DB) {
    throw new Error('D1 Database binding CODEFORGE_DB is not configured.');
  }
  return env.CODEFORGE_DB;
}

export async function getKVNamespace(env: { CODEFORGE_KV?: KVNamespace }): Promise<KVNamespace> {
  if (!env.CODEFORGE_KV) {
    throw new Error('KV Namespace binding CODEFORGE_KV is not configured.');
  }
  return env.CODEFORGE_KV;
}

// Example usage in Pages Functions (functions/api/data.ts):
/*
export const onRequest: PagesFunction<{ CODEFORGE_DB: D1Database; CODEFORGE_KV: KVNamespace }> = async (context) => {
  const { CODEFORGE_DB, CODEFORGE_KV } = context.env;
  
  // D1 Query
  const dbResult = await CODEFORGE_DB.prepare("SELECT * FROM files").all();
  
  // KV Get
  const kvValue = await CODEFORGE_KV.get("workspace_state");
  
  return Response.json({ dbResult, kvValue });
};
*/

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
