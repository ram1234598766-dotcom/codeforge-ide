export type WorkspaceRoute = { workspaceId: string; resource?: 'state' | 'files' } | null;

export function parseWorkspaceRoute(pathname: string): WorkspaceRoute {
  const path = pathname.replace(/\/$/, '');
  const match = path.match(/^\/api\/workspaces\/([a-f0-9-]{36})(?:\/(state|files))?$/i);
  if (!match) return null;
  return { workspaceId: match[1], resource: match[2] as 'state' | 'files' | undefined };
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
