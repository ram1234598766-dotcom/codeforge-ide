import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyHostedApp } from './verify-hosted-app.mjs';

function buildFetch(overrides = {}) {
  const html = `<!doctype html><html><head><link rel="stylesheet" href="/assets/app-abc.css"></head><body><div id="root"></div><script type="module" src="/assets/app-abc.js"></script></body></html>`;
  const responses = new Map([
    ['/', new Response(html, {status: 200, headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate'}})],
    ['/app', new Response(html, {status: 200, headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate'}})],
    ['/app/workspaces', new Response(html, {status: 200, headers: {'content-type':'text/html; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate'}})],
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
  assert.equal(result.deepLinkRoute.status,200);
  assert.match(result.deepLinkRoute.contentType, new RegExp('text/html', 'i'));
  assert.equal(result.health.database,'connected');
  assert.equal(result.authGuard.status,401);
  assert.deepEqual(result.assets.map(asset=>asset.path).sort(), ['/assets/app-abc.css','/assets/app-abc.js']);
});

test('requires no-store HTML when validating a completed production deployment', async () => {
  const html = '<!doctype html><html><body><div id="root"></div><script src="/assets/app-abc.js"></script><link rel="stylesheet" href="/assets/app-abc.css"></html>';
  await assert.rejects(
    verifyHostedApp({
      baseUrl:'https://codeforge.example',
      requireNoStoreHeaders:true,
      fetchImpl:buildFetch({
        '/app':new Response(html, {status:200,headers:{'content-type':'text/html; charset=utf-8'}})
      })
    }),
    /\/app HTML must not be cached/
  );
});

test('requires no-store HTML on nested /app routes after production deployment', async () => {
  const html = '<!doctype html><html><body><div id="root"></div></html>';
  await assert.rejects(
    verifyHostedApp({
      baseUrl:'https://codeforge.example',
      requireNoStoreHeaders:true,
      fetchImpl:buildFetch({
        '/app/workspaces':new Response(html, {status:200,headers:{'content-type':'text/html; charset=utf-8'}})
      })
    }),
    new RegExp('/app/workspaces HTML must not be cached')
  );
});

test('rejects a nested /app path that bypasses SPA fallback', async () => {
  await assert.rejects(
    verifyHostedApp({
      baseUrl:'https://codeforge.example',
      fetchImpl:buildFetch({
        '/app/workspaces':new Response('<!doctype html><html><body>not found</body></html>', {
          status:200,
          headers:{'content-type':'text/html; charset=utf-8'}
        })
      })
    }),
    new RegExp('/app/workspaces did not return the CodeForge SPA document')
  );
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

test('routes both Android SPA entry paths through Worker HTML cache policy', () => {
  const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const routesMatch = wrangler.match(/^\s*run_worker_first\s*=\s*\[([^\]]*)\]/m);
  assert.ok(routesMatch, 'wrangler.toml must define assets.run_worker_first');

  const workerFirstRoutes = [...routesMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  for (const route of ['/api/*', '/', '/index.html', '/app', '/app/*']) {
    assert.ok(
      workerFirstRoutes.includes(route),
      'Cloudflare must run the Worker first for ' + route + ' so SPA HTML receives the no-store cache policy.',
    );
  }
});
