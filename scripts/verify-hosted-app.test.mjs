import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyHostedApp } from './verify-hosted-app.mjs';

function buildFetch(overrides = {}) {
  const html = `<!doctype html><html><head><link rel="stylesheet" href="/assets/app-abc.css"></head><body><div id="root"></div><script type="module" src="/assets/app-abc.js"></script></body></html>`;
  const responses = new Map([
    ['/', new Response(html, {status: 200, headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate, max-age=0'}})],
    ['/app', new Response(html, {status: 200, headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate, max-age=0'}})],
    ['/api/health', new Response(JSON.stringify({ok:true,database:'connected'}), {status:200, headers:{'content-type':'application/json'}})],
    ['/api/config', new Response(JSON.stringify({url:'https://project.supabase.co',publishableKey:'sb_publishable_test'}), {status:200, headers:{'content-type':'application/json'}})],
    ['/api/workspaces', new Response(JSON.stringify({error:'Authentication required'}), {status:401, headers:{'content-type':'application/json'}})],
    ['/assets/app-abc.js', new Response('console.log("ready")', {status:200, headers:{'content-type':'text/javascript'}})],
    ['/assets/app-abc.css', new Response('body{margin:0}', {status:200, headers:{'content-type':'text/css'}})],
  ]);
  for (const [path, response] of Object.entries(overrides)) responses.set(path, response);
  return async (input) => {
    const path = new URL(String(input)).pathname;
    const response = responses.get(path);
    if (!response) throw new Error('Unexpected URL: ' + path);
    return response.clone();
  };
}

test('verifies SPA, Android /app, API configuration, assets and auth guard', async () => {
  const result = await verifyHostedApp({baseUrl:'https://codeforge.example',fetchImpl:buildFetch()});
  assert.equal(result.appRoute.status,200);
  assert.equal(result.health.database,'connected');
  assert.equal(result.authGuard.status,401);
  assert.deepEqual(result.assets.map(asset=>asset.path).sort(), ['/assets/app-abc.css','/assets/app-abc.js']);
});

test('rejects a Worker health response with a disconnected database', async () => {
  await assert.rejects(
    verifyHostedApp({baseUrl:'https://codeforge.example',fetchImpl:buildFetch({
      '/api/health':new Response(JSON.stringify({ok:false,database:'unavailable'}), {status:503,headers:{'content-type':'application/json'}})
    })}),
    /\/api\/health returned HTTP 503/
  );
});

test('rejects an authentication endpoint that is publicly accessible', async () => {
  await assert.rejects(
    verifyHostedApp({baseUrl:'https://codeforge.example',fetchImpl:buildFetch({
      '/api/workspaces':new Response(JSON.stringify({workspaces:[]}), {status:200,headers:{'content-type':'application/json'}})
    })}),
    /\/api\/workspaces must reject an unauthenticated request with HTTP 401/
  );
});

test('rejects a missing SPA asset', async () => {
  await assert.rejects(
    verifyHostedApp({baseUrl:'https://codeforge.example',fetchImpl:buildFetch({
      '/assets/app-abc.js':new Response('not found',{status:404,headers:{'content-type':'text/plain'}})
    })}),
    /\/assets\/app-abc.js returned HTTP 404/
  );
});
