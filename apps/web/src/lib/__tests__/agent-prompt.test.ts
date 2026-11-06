import { describe, expect, it } from 'vitest';
import { buildAgentSystemPrompt, buildAgentUserMessage, isSafeAgentContextPath, selectSafeAgentContextFiles } from '../agent-prompt';

describe('safe AI workspace context', () => {
  it('excludes common credential files and generated dependency trees', () => {
    for (const path of ['.env', '.env.production', 'config/service-account.json', 'config/api-key.json', 'secret.json', 'auth_token.txt', 'certs/release.p12', 'keys/signing.jks', 'node_modules/react/index.js', '.git/config']) {
      expect(isSafeAgentContextPath(path)).toBe(false);
    }
    expect(isSafeAgentContextPath('src/App.tsx')).toBe(true);
    expect(isSafeAgentContextPath('README.md')).toBe(true);
  });

  it('prioritizes the active file and deduplicates paths case-insensitively', () => {
    const selected = selectSafeAgentContextFiles([
      { path: 'src/App.tsx', content: 'stale' },
      { path: 'src/util.ts', content: 'utility' },
      { path: '.env', content: 'SECRET=value' },
    ], 'src/App.tsx', 'current');
    expect(selected).toEqual([
      { path: 'src/App.tsx', content: 'current' },
      { path: 'src/util.ts', content: 'utility' },
    ]);
  });

  it('caps file count and total context size', () => {
    const files = Array.from({ length: 15 }, (_, index) => ({ path: `src/file-${index}.ts`, content: 'x'.repeat(5_000) }));
    const selected = selectSafeAgentContextFiles(files);
    expect(selected).toHaveLength(10);
    expect(selected.reduce((sum, file) => sum + file.content.length, 0)).toBeLessThanOrEqual(30_000);
  });

  it('builds an explicit JSON-only coding contract with guarded writes', () => {
    const system = buildAgentSystemPrompt('coder', true);
    expect(system).toContain('untrusted reference data');
    expect(system).toContain('review proposals');
    expect(system).toContain('Workspace file write access: enabled');
    expect(JSON.parse(buildAgentUserMessage(' fix it ', 'src/App.tsx', [{ path: 'src/App.tsx', content: 'x' }])).task).toBe('fix it');
  });
});
