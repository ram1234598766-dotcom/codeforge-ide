import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const identifier = appSource.indexOf('WEBVIEW_READY_SCRIPT');
assert.notEqual(identifier, -1, 'The native shell must expose its injected WebView readiness script.');
const assignment = appSource.indexOf('=', identifier + 'WEBVIEW_READY_SCRIPT'.length);
const backtick = String.fromCharCode(96);
const opening = appSource.indexOf(backtick, assignment + 1);
assert.notEqual(opening, -1, 'The injected WebView readiness script must start with a template literal.');
const closing = appSource.indexOf(backtick + ';', opening + 1);
assert.notEqual(closing, -1, 'The injected WebView readiness script must be closed.');
const scriptSource = appSource.slice(opening + 1, closing);
const readinessScript = runInNewContext(backtick + scriptSource + backtick);
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

test('a generic readiness marker without rendered app content is not enough', () => {
  assert.deepEqual(runReadiness({ readinessMarker: true }), []);
});

test('a loading placeholder without recognizable app content is not ready', () => {
  assert.deepEqual(runReadiness(), []);
});

test('visible app content before document completion is not ready', () => {
  assert.deepEqual(runReadiness({ readyState: 'interactive', authHeading: 'Welcome back.' }), []);
});

test('non-app routes never report CodeForge readiness', () => {
  assert.deepEqual(runReadiness({ pathname: '/oauth/callback', authHeading: 'Welcome back.' }), []);
});
