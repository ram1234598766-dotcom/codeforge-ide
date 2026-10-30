import { apiRequest } from './supabase';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function listWorkspaces(): Promise<Workspace[]> {
  const result = await apiRequest<{ workspaces: Workspace[] }>('/api/workspaces');
  return result.workspaces;
}

export async function createWorkspace(name: string, description?: string): Promise<Workspace> {
  const result = await apiRequest<{ workspace: Workspace }>('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
  return result.workspace;
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
  const result = await apiRequest<{ workspace: Workspace }>(`/api/workspaces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return result.workspace;
}

export async function deleteWorkspace(id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/workspaces/${id}`, { method: 'DELETE' });
}

export async function getWorkspaceState(id: string): Promise<unknown> {
  const result = await apiRequest<{ state: unknown }>(`/api/workspaces/${id}/state`);
  return result.state;
}

export async function saveWorkspaceState(id: string, state: unknown): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/workspaces/${id}/state`, {
    method: 'PUT',
    body: JSON.stringify({ state }),
  });
}

export async function listWorkspaceFiles(id: string) {
  const result = await apiRequest<{ files: Array<{ id: string; path: string; content: string; language: string | null }> }>(`/api/workspaces/${id}/files`);
  return result.files;
}

export async function saveWorkspaceFile(id: string, path: string, content: string, language?: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/workspaces/${id}/files`, {
    method: 'PUT',
    body: JSON.stringify({ path, content, language }),
  });
}
