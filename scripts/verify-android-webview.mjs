import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../apps/mobile/App.tsx', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('./android-install-smoke.sh', import.meta.url), 'utf8');
assert.match(app, /onHttpError=/, 'WebView must surface HTTP failures.');
assert.match(app, /onRenderProcessGone=/, 'WebView must recover from renderer termination.');
assert.match(app, /onContentProcessDidTerminate=/, 'WebView must recover from content-process termination.');
assert.match(app, /injectedJavaScript=/, 'WebView must verify that the hosted SPA rendered.');
assert.match(app, /appRoot\s*&&\s*appRoot\.children\.length\s*>\s*0/, 'WebView readiness must support already-deployed SPA builds that predate the explicit readiness marker.');
assert.match(app, /onMessage=/, 'WebView must receive the SPA readiness handshake.');
assert.match(app, /CodeForge app ready/, 'WebView must expose an accessibility readiness signal.');
assert.match(app, /Linking\.openURL/, 'Error state must offer an external-browser fallback.');
assert.match(app, /canGoBack/, 'Back navigation must respect WebView history.');
assert.doesNotMatch(app, /console\.(?:log|error)\(/, 'Diagnostics must not log URL query strings or auth data.');
assert.match(smoke, /uiautomator dump/, 'Emulator smoke must inspect accessibility state.');
assert.match(smoke, /CodeForge app ready/, 'Emulator smoke must wait for the hosted app to render.');
console.log('Android WebView startup, recovery, accessibility, and hosted-app smoke contract passed.');
