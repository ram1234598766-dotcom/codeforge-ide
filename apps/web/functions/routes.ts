export type WorkspaceRoute = { workspaceId: string; resource?: 'state' | 'files' } | null;

export function parseWorkspaceRoute(pathname: string): WorkspaceRoute {
  const path = pathname.replace(/\/$/, '');
  const match = path.match(/^\/api\/workspaces\/([a-f0-9-]{36})(?:\/(state|files))?$/i);
  if (!match) return null;
  return { workspaceId: match[1], resource: match[2] as 'state' | 'files' | undefined };
}
