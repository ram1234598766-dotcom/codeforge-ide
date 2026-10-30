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

import { normalizeAgentType, validateAgentTask } from '../routes';

describe('validateAgentTask', () => {
  it('rejects empty and non-string tasks', () => {
    expect(validateAgentTask('   ')).toBe('Task is required.');
    expect(validateAgentTask(null)).toBe('Task must be text.');
  });
  it('enforces a bounded prompt size', () => {
    expect(validateAgentTask('x'.repeat(12001))).toBe('Task must be 12,000 characters or fewer.');
  });
  it('accepts a normal coding request', () => {
    expect(validateAgentTask('Review this TypeScript file')).toBeNull();
  });
});

describe('normalizeAgentType', () => {
  it('accepts supported specialist roles', () => {
    expect(normalizeAgentType('reviewer')).toBe('reviewer');
    expect(normalizeAgentType('security')).toBe('security');
  });
  it('falls back to the coder role for unknown input', () => {
    expect(normalizeAgentType('root')).toBe('coder');
    expect(normalizeAgentType(null)).toBe('coder');
  });
});

import { normalizeSupabaseUrl } from '../../src/lib/supabase-url';

describe('normalizeSupabaseUrl', () => {
  it('removes the REST endpoint suffix from a project URL', () => {
    expect(normalizeSupabaseUrl('https://project.supabase.co/rest/v1/')).toBe('https://project.supabase.co');
  });
  it('preserves a clean project URL', () => {
    expect(normalizeSupabaseUrl('https://project.supabase.co/')).toBe('https://project.supabase.co');
  });
  it('returns an empty string for missing configuration', () => {
    expect(normalizeSupabaseUrl(undefined)).toBe('');
  });
});

import { validateWorkspaceFilePath, validateWorkspaceName } from '../routes';

describe('validateWorkspaceName', () => {
  it('accepts trimmed workspace names', () => {
    expect(validateWorkspaceName(' My project ')).toBeNull();
  });
  it('rejects empty and oversized names', () => {
    expect(validateWorkspaceName('   ')).toBe('Workspace name must be 1–100 characters.');
    expect(validateWorkspaceName('x'.repeat(101))).toBe('Workspace name must be 1–100 characters.');
  });
});

describe('validateWorkspaceFilePath', () => {
  it('accepts relative nested file paths', () => {
    expect(validateWorkspaceFilePath('/src/components/App.tsx')).toBeNull();
  });
  it('rejects traversal and empty segments', () => {
    expect(validateWorkspaceFilePath('../secrets.txt')).toBe('Invalid file path.');
    expect(validateWorkspaceFilePath('src//App.tsx')).toBe('Invalid file path.');
    expect(validateWorkspaceFilePath('src/../secrets.txt')).toBe('Invalid file path.');
  });
});

describe('parseWorkspaceRoute version history', () => {
  it('matches workspace file version routes', () => {
    expect(parseWorkspaceRoute(`/api/workspaces/${id}/versions`)).toEqual({ workspaceId: id, resource: 'versions' });
  });
});

import { parseWorkspaceChangeRoute, validateCodeChange } from '../routes';

describe('parseWorkspaceChangeRoute', () => {
  it('matches the workspace change queue', () => {
    expect(parseWorkspaceChangeRoute(`/api/workspaces/${id}/changes`)).toEqual({ workspaceId: id });
  });
  it('matches explicit approve and reject actions', () => {
    const changeId = '223e4567-e89b-12d3-a456-426614174000';
    expect(parseWorkspaceChangeRoute(`/api/workspaces/${id}/changes/${changeId}/approve`)).toEqual({ workspaceId: id, changeId, action: 'approve' });
    expect(parseWorkspaceChangeRoute(`/api/workspaces/${id}/changes/${changeId}/reject`)).toEqual({ workspaceId: id, changeId, action: 'reject' });
  });
  it('rejects unsupported change actions and malformed ids', () => {
    expect(parseWorkspaceChangeRoute(`/api/workspaces/${id}/changes/${id}/apply`)).toBeNull();
    expect(parseWorkspaceChangeRoute('/api/workspaces/nope/changes')).toBeNull();
  });
});

describe('validateCodeChange', () => {
  it('accepts a valid relative path and bounded proposed content', () => {
    expect(validateCodeChange('src/App.tsx', 'export default function App() {}')).toBeNull();
  });
  it('rejects unsafe paths and non-string content', () => {
    expect(validateCodeChange('../secrets.txt', 'x')).toBe('Invalid file path.');
    expect(validateCodeChange('src/App.tsx', null)).toBe('Proposed content must be text.');
  });
  it('rejects proposals larger than one megabyte', () => {
    expect(validateCodeChange('src/App.tsx', 'x'.repeat(1_000_001))).toBe('Proposed content must be 1 MB or smaller.');
  });
});
