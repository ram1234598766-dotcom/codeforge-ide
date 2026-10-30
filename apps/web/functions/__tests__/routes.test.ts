import { describe, expect, it } from 'vitest';
import { parseWorkspaceRoute } from '../routes';

const id = '123e4567-e89b-12d3-a456-426614174000';

describe('parseWorkspaceRoute', () => {
  it('matches a workspace root route for rename and delete', () => {
    expect(parseWorkspaceRoute(`/api/workspaces/${id}`)).toEqual({ workspaceId: id, resource: undefined });
  });
  it('matches the workspace state route', () => {
    expect(parseWorkspaceRoute(`/api/workspaces/${id}/state`)).toEqual({ workspaceId: id, resource: 'state' });
  });
  it('matches the workspace files route', () => {
    expect(parseWorkspaceRoute(`/api/workspaces/${id}/files`)).toEqual({ workspaceId: id, resource: 'files' });
  });
  it('rejects unrelated and malformed routes', () => {
    expect(parseWorkspaceRoute('/api/workspaces/not-a-uuid')).toBeNull();
    expect(parseWorkspaceRoute(`/api/workspaces/${id}/unknown`)).toBeNull();
    expect(parseWorkspaceRoute('/api/users')).toBeNull();
  });
});
