import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWebViewNavigation } from './webview-navigation.js';

const origin = 'https://codeforge-ide.vasudevaya.workers.dev';

test('recognizes the CodeForge app route and nested routes', () => {
  assert.equal(classifyWebViewNavigation(`${origin}/app`, origin), 'codeforge-app');
  assert.equal(classifyWebViewNavigation(`${origin}/app/workspaces/123`, origin), 'codeforge-app');
});

test('does not treat a prefix collision or same-origin root as a mounted app', () => {
  assert.equal(classifyWebViewNavigation(`${origin}/application`, origin), 'external-https');
  assert.equal(classifyWebViewNavigation(`${origin}/`, origin), 'external-https');
  assert.equal(classifyWebViewNavigation(`https://user@${origin.slice('https://'.length)}/app`, origin), 'invalid');
  assert.equal(classifyWebViewNavigation('https://user:password@accounts.google.com/login', origin), 'invalid');
});

test('keeps external HTTPS pages usable without claiming CodeForge readiness', () => {
  assert.equal(
    classifyWebViewNavigation('https://accounts.google.com/o/oauth2/auth?code=redacted', origin),
    'external-https',
  );
});

test('rejects insecure and malformed URLs', () => {
  assert.equal(
    classifyWebViewNavigation('http://codeforge-ide.vasudevaya.workers.dev/app', origin),
    'invalid',
  );
  assert.equal(classifyWebViewNavigation('not-a-url', origin), 'invalid');
  assert.equal(classifyWebViewNavigation('javascript:alert(1)', origin), 'invalid');
  assert.equal(classifyWebViewNavigation('file:///data/local/tmp/index.html', origin), 'invalid');
});
