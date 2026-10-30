import { supabaseRequest } from './supabase';

export type Workspace = { id: string; name: string; slug: string; description: string | null };

export function listWorkspaces() {
  return supabaseRequest<Workspace[]>('workspaces?select=id,name,slug,description&order=created_at.desc');
}
