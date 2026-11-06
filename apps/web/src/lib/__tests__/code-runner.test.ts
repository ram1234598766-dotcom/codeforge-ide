import { describe, expect, it } from 'vitest';
import { buildBrowserRunDocument, getRunnableKind } from '../code-runner';

describe('getRunnableKind', () => {
  it('recognizes HTML and JavaScript without claiming unsupported runtimes', () => {
    expect(getRunnableKind('index.html')).toBe('html');
    expect(getRunnableKind('src/main.mjs')).toBe('javascript');
    expect(getRunnableKind('src/index.js')).toBe('javascript');
    expect(getRunnableKind('src/App.tsx')).toBeNull();
    expect(getRunnableKind('main.py')).toBeNull();
  });
});

describe('buildBrowserRunDocument', () => {
  it('adds a strict content policy and run-scoped console bridge to HTML', () => {
    const document = buildBrowserRunDocument('index.html', '<html><head></head><body>Hello</body></html>', 'run-12345678');
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain('Content-Security-Policy');
    expect(document).toContain("script-src 'none'");
    expect(document).not.toContain('__codeforgeRun');
    expect(document).toContain('<body>Hello</body>');
  });

  it('runs JavaScript in a disposable worker with a hard timeout and no network access', () => {
    const document = buildBrowserRunDocument('main.js', 'console.log("</script>");', 'run-12345678');
    expect(document).toContain("connect-src 'none'");
    expect(document).toContain('worker-src blob:');
    expect(document).toContain('new Worker(');
    expect(document).toContain('new MessageChannel()');
    expect(document).toContain('MessagePort.prototype.postMessage.bind(port)');
    expect(document).toContain('5000');
    expect(document).toContain('\\\\u003c/script>');
    expect(document).not.toContain('console.log("</script>");');
  });

  it('rejects unsupported files, invalid run IDs, and oversized source', () => {
    expect(() => buildBrowserRunDocument('main.py', 'print(1)', 'run-12345678')).toThrow('supports HTML');
    expect(() => buildBrowserRunDocument('main.js', 'console.log(1)', 'bad')).toThrow('identifier');
    expect(() => buildBrowserRunDocument('main.js', 'x'.repeat(250_001), 'run-12345678')).toThrow('250 KB');
  });
});
