import { describe, expect, it } from 'vitest';
import {
  buildHtmlPreview,
  getExecutionLanguage,
  isWorkspaceFileSafeForExecution,
  prepareWorkspaceExecution,
  validateWorkspaceRunRequest,
} from '../execution';

describe('getExecutionLanguage', () => {
  it('recognizes supported source and preview file types case-insensitively', () => {
    expect(getExecutionLanguage('src/App.JSX')).toBe('react');
    expect(getExecutionLanguage('src/main.ts')).toBe('typescript');
    expect(getExecutionLanguage('scripts/task.py')).toBe('python');
    expect(getExecutionLanguage('public/index.html')).toBe('html');
  });

  it('does not treat unsupported or pathless files as runnable', () => {
    expect(getExecutionLanguage('package.json')).toBeNull();
    expect(getExecutionLanguage('README.md')).toBeNull();
    expect(getExecutionLanguage('../app.js')).toBeNull();
  });
});

describe('validateWorkspaceRunRequest', () => {
  it('accepts a valid, bounded source file', () => {
    expect(validateWorkspaceRunRequest('src/App.tsx', 'export default function App() {}')).toBeNull();
  });

  it('rejects invalid paths and unsupported extensions', () => {
    expect(validateWorkspaceRunRequest('../secret.js', 'console.log(1)')).toBe('Invalid file path.');
    expect(validateWorkspaceRunRequest('README.md', 'hello')).toContain('JavaScript');
  });

  it('rejects non-text and oversized editor buffers', () => {
    expect(validateWorkspaceRunRequest('src/main.js', null)).toBe('File content must be text.');
    expect(validateWorkspaceRunRequest('src/main.js', 'x'.repeat(256_001))).toBe('Run file must be 256 KB or smaller.');
  });

  it('refuses credentials and environment files as entrypoints', () => {
    expect(validateWorkspaceRunRequest('.env.local', 'SECRET=value')).toBe('This file is protected and cannot be executed.');
    expect(validateWorkspaceRunRequest('certs/private.pem', 'secret')).toBe('This file is protected and cannot be executed.');
  });
});

describe('isWorkspaceFileSafeForExecution', () => {
  it('excludes secrets, generated output, dependencies and repository metadata', () => {
    for (const path of [
      '.env',
      '.env.production',
      '.npmrc',
      'config/credentials.json',
      'certs/server.key',
      '.git/config',
      'node_modules/react/index.js',
      'dist/assets/app.js',
      '.ssh/id_ed25519',
    ]) {
      expect(isWorkspaceFileSafeForExecution(path), path).toBe(false);
    }
  });

  it('keeps source files and ordinary project configuration', () => {
    expect(isWorkspaceFileSafeForExecution('src/App.tsx')).toBe(true);
    expect(isWorkspaceFileSafeForExecution('package.json')).toBe(true);
    expect(isWorkspaceFileSafeForExecution('tsconfig.json')).toBe(true);
  });
});

describe('prepareWorkspaceExecution', () => {
  it('uses the current editor buffer instead of stale saved content', () => {
    const result = prepareWorkspaceExecution(
      [
        { path: 'src/App.tsx', content: 'export default () => <h1>Saved</h1>' },
        { path: 'src/util.ts', content: 'export const answer = 42' },
        { path: '.env.local', content: 'PRIVATE=value' },
      ],
      'src/App.tsx',
      'export default () => <h1>Unsaved</h1>',
    );

    expect(result.error).toBeUndefined();
    expect(result.files).toEqual([
      { path: 'src/App.tsx', content: 'export default () => <h1>Unsaved</h1>' },
      { path: 'src/util.ts', content: 'export const answer = 42' },
    ]);
  });

  it('requires the selected file to exist in the workspace', () => {
    const result = prepareWorkspaceExecution(
      [{ path: 'src/other.ts', content: '' }],
      'src/App.ts',
      'console.log(1)',
    );
    expect(result.error).toBe('The selected file is not saved in this workspace yet.');
  });

  it('enforces file-count and total-project limits', () => {
    const tooMany = Array.from({ length: 81 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      content: '',
    }));
    expect(prepareWorkspaceExecution(tooMany, 'src/file-0.ts', '').error)
      .toBe('This workspace has too many source files to run. Keep the runnable project under 80 files.');

    expect(prepareWorkspaceExecution(
      [
        { path: 'src/main.ts', content: '' },
        { path: 'src/large.ts', content: 'x'.repeat(1_500_001) },
      ],
      'src/main.ts',
      '',
    ).error).toBe('Runnable workspace content must be 1.5 MB or smaller.');
  });
});

describe('buildHtmlPreview', () => {
  it('inlines local JavaScript and CSS while blocking external network resources', () => {
    const result = buildHtmlPreview(
      'public/index.html',
      '<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><h1>Run</h1><script src="./app.js"></script><script src="https://evil.example/app.js"></script></body></html>',
      [
        { path: 'public/index.html', content: '' },
        { path: 'public/style.css', content: 'h1 { color: red; }' },
        { path: 'public/app.js', content: 'document.body.dataset.started = "yes";' },
      ],
    );

    expect(result).toContain('h1 { color: red; }');
    expect(result).toContain('document.body.dataset.started');
    expect(result).not.toContain('https://evil.example/app.js');
    expect(result).toContain("connect-src &#39;none&#39;");
  });

  it('keeps an ordinary static HTML document renderable and adds a restrictive policy', () => {
    const result = buildHtmlPreview('index.html', '<h1>Hello</h1>', [{ path: 'index.html', content: '<h1>Hello</h1>' }]);
    expect(result).toContain('<h1>Hello</h1>');
    expect(result).toContain('Content-Security-Policy');
    expect(result).toContain("default-src 'none'");
  });
});
