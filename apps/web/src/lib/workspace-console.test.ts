import { describe, expect, it } from 'vitest';
import { runWorkspaceConsoleCommand } from './workspace-console';

const context = {
  workspaceName: 'Demo project',
  workspaceId: 'workspace-1',
  selectedPath: 'src/App.tsx',
  dirty: true,
  email: 'dev@example.com',
  files: [
    { path: 'README.md', content: '# Demo\nSearchable workspace notes' },
    { path: 'src/App.tsx', content: 'export default function App() {\n  return <h1>Hello</h1>;\n}' },
  ],
};

describe('workspace console', () => {
  it('provides help and workspace path without invoking a shell', () => {
    expect(runWorkspaceConsoleCommand('help', context).lines[0]).toContain('read-only');
    expect(runWorkspaceConsoleCommand('pwd', context).lines).toEqual(['/workspace/Demo project']);
  });
  it('lists files and prints a selected file', () => {
    expect(runWorkspaceConsoleCommand('ls src/', context).lines).toEqual(['src/App.tsx']);
    expect(runWorkspaceConsoleCommand('cat src/App.tsx', context).lines).toContain('  return <h1>Hello</h1>;');
  });
  it('supports bounded head and word count output', () => {
    expect(runWorkspaceConsoleCommand('head src/App.tsx 2', context).lines).toHaveLength(2);
    expect(runWorkspaceConsoleCommand('wc src/App.tsx', context).lines[0]).toContain('3 lines');
    expect(runWorkspaceConsoleCommand('head src/App.tsx 9999', context).lines.length).toBeLessThanOrEqual(100);
  });
  it('searches content and reports one-based line numbers', () => {
    expect(runWorkspaceConsoleCommand('grep searchable', context).lines).toEqual(['README.md:2: Searchable workspace notes']);
    expect(runWorkspaceConsoleCommand('grep missing', context).lines).toEqual(['(no matches)']);
  });
  it('opens existing files and rejects unknown paths', () => {
    expect(runWorkspaceConsoleCommand('open src/App.tsx', context).openPath).toBe('src/App.tsx');
    expect(runWorkspaceConsoleCommand('open ../secrets.txt', context).lines[0]).toContain('File not found');
  });
  it('shows actual editor state and supports clear', () => {
    expect(runWorkspaceConsoleCommand('status', context).lines).toContain('Editor: unsaved changes');
    expect(runWorkspaceConsoleCommand('clear', context).clear).toBe(true);
  });
  it('does not execute arbitrary shell commands', () => {
    expect(runWorkspaceConsoleCommand('rm -rf /', context).lines[0]).toContain('Command not found');
  });
});
