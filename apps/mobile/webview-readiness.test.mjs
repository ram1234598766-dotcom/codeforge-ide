import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const scriptMatch = appSource.match(/const WEBVIEW_READY_SCRIPT = `([\\s\\S]*?)`;/);
assert.ok(scriptMatch, 'The native shell must expose its injected WebView readiness script.');

const readinessScript = runInNewContext('`' + scriptMatch[1] + '`');
const origin = 'https://codeforge-ide.vasudevaya.workers.dev';

function runReadiness({
  pathname = '/app',
  readyState = 'complete',
  authHeading = '',
  previewText = '',
  readinessMarker = false,
} = {}) {
  const messages = [];
  const document = {
    readyState,
    documentElement: {},
    addEventListener() {},
    querySelector(selector) {
      if (selector === '[data-codeforge-app-ready="true"]') {
        return readinessMarker ? {} : null;
      }
      if (selector === '#root') return { children: [] };
      if (selector === '.auth-card h1') {
        return authHeading ? { textContent: authHeading } : null;
      }
      if (selector === '.browser-preview-banner') {
        return previewText ? { textContent: previewText } : null;
      }
      return null;
    },
  };
  const window = {
    location: { origin, pathname },
    addEventListener() {},
    setTimeout() { return 1; },
    ReactNativeWebView: {
      postMessage(payload) {
        messages.push(JSON.parse(payload));
      },
    },
  };

  runInNewContext(readinessScript, {
    window,
    document,
    Date,
    MutationObserver: undefined,
  });
  return messages;
}

test('legacy hosted sign-in UI is ready without the newer optional readiness marker', () => {
  const messages = runReadiness({ authHeading: 'Welcome back.' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'codeforge-ready');
  assert.equal(messages[0].details.authScreen, true);
  assert.equal(messages[0].details.readinessMarker, false);
});

test('legacy workspace UI is ready without the newer optional readiness marker', () => {
  const messages = runReadiness({ previewText: 'CodeForge workspace preview' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'codeforge-ready');
  assert.equal(messages[0].details.workspaceShell, true);
  assert.equal(messages[0].details.readinessMarker, false);
});

test('a loading placeholder without recognizable app content is not ready', () => {
  assert.deepEqual(runReadiness(), []);
});

test('non-app routes never report CodeForge readiness', () => {
  assert.deepEqual(runReadiness({ pathname: '/oauth/callback', authHeading: 'Welcome back.' }), []);
});
