export type WorkspaceRoute = { workspaceId: string; resource?: 'state' | 'files' | 'versions' | 'members' | 'invites' } | null;

export function parseWorkspaceRoute(pathname: string): WorkspaceRoute {
  const path = pathname.replace(/\/$/, '');
  const match = path.match(/^\/api\/workspaces\/([a-f0-9-]{36})(?:\/(state|files|versions|members|invites))?$/i);
  if (!match) return null;
  return { workspaceId: match[1], resource: match[2] as 'state' | 'files' | 'versions' | 'members' | 'invites' | undefined };
}

export type WorkspaceChangeRoute = { workspaceId: string; changeId?: string; action?: 'approve' | 'reject' } | null;

export function parseWorkspaceChangeRoute(pathname: string): WorkspaceChangeRoute {
  const path = pathname.replace(/\/$/, '');
  const match = path.match(/^\/api\/workspaces\/([a-f0-9-]{36})\/changes(?:\/([a-f0-9-]{36})\/(approve|reject))?$/i);
  if (!match) return null;
  return { workspaceId: match[1], ...(match[2] ? { changeId: match[2], action: match[3] as 'approve' | 'reject' } : {}) };
}

export function validateCodeChange(path: unknown, content: unknown): string | null {
  const pathError = validateWorkspaceFilePath(path);
  if (pathError) return pathError;
  if (typeof content !== 'string') return 'Proposed content must be text.';
  if (new TextEncoder().encode(content).byteLength > 1_000_000) return 'Proposed content must be 1 MB or smaller.';
  return null;
}

export const AGENT_TYPES = ['planner', 'coder', 'reviewer', 'debugger', 'tester', 'refactorer', 'security', 'documentation'] as const;
export type AgentType = typeof AGENT_TYPES[number];

export function normalizeAgentType(value: unknown): AgentType {
  return typeof value === 'string' && (AGENT_TYPES as readonly string[]).includes(value)
    ? value as AgentType
    : 'coder';
}

export function validateAgentTask(task: unknown): string | null {
  if (typeof task !== 'string') return 'Task must be text.';
  const trimmed = task.trim();
  if (!trimmed) return 'Task is required.';
  if (trimmed.length > 12000) return 'Task must be 12,000 characters or fewer.';
  return null;
}

export function validateWorkspaceName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Workspace name must be text.';
  const value = name.trim();
  if (!value || value.length > 100) return 'Workspace name must be 1–100 characters.';
  return null;
}

export function validateWorkspaceFilePath(path: unknown): string | null {
  if (typeof path !== 'string') return 'File path must be text.';
  const value = path.trim().replace(/^\/+/, '');
  if (!value || value.length > 500 || value.split('/').some(part => !part || part === '.' || part === '..')) {
    return 'Invalid file path.';
  }
  return null;
}

export function canEditWorkspaceRole(role: string | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor';
}
export function canAdminWorkspaceRole(role: string | null): boolean {
  return role === 'owner' || role === 'admin';
}
export function canDeleteWorkspaceRole(role: string | null): boolean {
  return role === 'owner';
}
