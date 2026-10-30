import { apiRequest } from './supabase';

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
  role?: 'owner' | 'admin' | 'editor' | 'viewer';
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

export async function deleteWorkspaceFile(id: string, path: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/workspaces/${id}/files`, {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  });
}

export type AgentRun = {
  id: string;
  workspace_id: string | null;
  task: string;
  agent_type: string;
  status: string;
  result_json: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityEvent = {
  id: string;
  workspace_id: string | null;
  action: string;
  metadata_json: string;
  created_at: string;
};

export async function listAgentRuns(): Promise<AgentRun[]> {
  const result = await apiRequest<{ runs: AgentRun[] }>('/api/agents/runs');
  return result.runs;
}

export async function listActivity(): Promise<ActivityEvent[]> {
  const result = await apiRequest<{ events: ActivityEvent[] }>('/api/activity');
  return result.events;
}

export type ProviderId = 'openai' | 'deepseek' | 'groq' | 'openrouter';
export type ProviderConfig = {
  provider: ProviderId;
  model: string;
  base_url: string;
  created_at: string;
  updated_at: string;
};

export async function listProviderConfigs(): Promise<ProviderConfig[]> {
  const result = await apiRequest<{ providers: ProviderConfig[] }>('/api/settings/providers');
  return result.providers;
}

export async function saveProviderConfig(provider: ProviderId, model: string, apiKey: string): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/settings/providers', {
    method: 'PUT',
    body: JSON.stringify({ provider, model, apiKey }),
  });
}

export async function testProviderConfig(provider: ProviderId): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/settings/providers/test', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
}

export async function deleteProviderConfig(provider: ProviderId): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/settings/providers', {
    method: 'DELETE',
    body: JSON.stringify({ provider }),
  });
}

export type FileVersion = {
  id: string;
  path: string;
  content: string;
  language: string | null;
  created_at: string;
};

export async function listFileVersions(workspaceId: string, path: string): Promise<FileVersion[]> {
  const result = await apiRequest<{ versions: FileVersion[] }>(`/api/workspaces/${workspaceId}/versions?path=${encodeURIComponent(path)}`);
  return result.versions;
}

export async function restoreFileVersion(workspaceId: string, versionId: string): Promise<{ path: string; content: string; language: string | null }> {
  const result = await apiRequest<{ ok: boolean; path: string; content: string; language: string | null }>(`/api/workspaces/${workspaceId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
  return result;
}

export type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  email?: string | null;
};

export type WorkspaceMember = {
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function getProfile(): Promise<Profile> {
  const result = await apiRequest<{ profile: Profile; email: string | null }>('/api/profile');
  return { ...result.profile, email: result.email };
}

export async function updateProfile(displayName: string, avatarUrl: string): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({ displayName, avatarUrl }),
  });
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const result = await apiRequest<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members`);
  return result.members;
}

export async function createWorkspaceInvite(workspaceId: string, email: string, role: 'admin' | 'editor' | 'viewer'): Promise<string> {
  const result = await apiRequest<{ inviteUrl: string }>(`/api/workspaces/${workspaceId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  return result.inviteUrl;
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/workspaces/${workspaceId}/members`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });
}

export async function acceptWorkspaceInvite(token: string): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export type CodeChangeRequest = {
  id: string;
  file_path: string;
  original_content: string;
  proposed_content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
};

export async function listCodeChanges(workspaceId: string): Promise<CodeChangeRequest[]> {
  const result = await apiRequest<{ changes: CodeChangeRequest[] }>(\`/api/workspaces/\${workspaceId}/changes\`);
  return result.changes;
}

export async function proposeCodeChange(workspaceId: string, path: string, proposedContent: string): Promise<CodeChangeRequest> {
  const result = await apiRequest<{ change: CodeChangeRequest }>(\`/api/workspaces/\${workspaceId}/changes\`, {
    method: 'POST',
    body: JSON.stringify({ path, proposedContent }),
  });
  return result.change;
}

export async function approveCodeChange(workspaceId: string, changeId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(\`/api/workspaces/\${workspaceId}/changes/\${changeId}/approve\`, { method: 'POST' });
}

export async function rejectCodeChange(workspaceId: string, changeId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(\`/api/workspaces/\${workspaceId}/changes/\${changeId}/reject\`, { method: 'POST' });
}
