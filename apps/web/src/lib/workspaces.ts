import { supabaseRequest } from './supabase';
import { getD1Database, getKVNamespace } from './cloudflare';

export type Workspace = { id: string; name: string; slug: string; description: string | null };

export function listWorkspaces() {
  return supabaseRequest<Workspace[]>('workspaces?select=id,name,slug,description&order=created_at.desc');
}

// D1 & KV Integration for Workspace State
export async function syncWorkspaceStateToD1(env: any, workspaceId: string, state: string) {
  const db = await getD1Database(env);
  await db.prepare(
    "INSERT INTO workspace_state (workspace_id, state) VALUES (?, ?) ON CONFLICT(workspace_id) DO UPDATE SET state = excluded.state"
  )
  .bind(workspaceId, state)
  .run();
}

export async function getWorkspaceStateFromKV(env: any, workspaceId: string) {
  const kv = await getKVNamespace(env);
  return await kv.get(`workspace_${workspaceId}`);
}

export async function setWorkspaceStateInKV(env: any, workspaceId: string, state: string) {
  const kv = await getKVNamespace(env);
  return await kv.put(`workspace_${workspaceId}`, state);
}
