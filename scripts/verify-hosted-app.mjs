import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://codeforge-ide.vasudevaya.workers.dev';

async function readJson(response, path) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(path + ' returned an unexpected content type: ' + contentType);
  }
  return response.json();
}

async function expectOk(fetchImpl, url, path, accept) {
  const response = await fetchImpl(url, { redirect: 'follow', headers: { accept } });
  if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status);
  return response;
}

export async function verifyHostedApp({ baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, requireNoStoreHeaders = false } = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password) {
    throw new Error('The hosted CodeForge base URL must be a credential-free HTTPS URL.');
  }
  const origin = base.origin;
  const request = path => new URL(path, origin).toString();

  const rootResponse = await expectOk(fetchImpl, request('/'), '/', 'text/html');
  const rootType = rootResponse.headers.get('content-type') || '';
  if (!rootType.toLowerCase().includes('text/html')) {
    throw new Error('/ returned an unexpected content type: ' + rootType);
  }
  await rootResponse.text();

  const appResponse = await expectOk(fetchImpl, request('/app'), '/app', 'text/html');
  const appType = appResponse.headers.get('content-type') || '';
  if (!appType.toLowerCase().includes('text/html')) {
    throw new Error('/app returned an unexpected content type: ' + appType);
  }
  const html = await appResponse.text();
  if (!html.includes('id="root"')) throw new Error('/app did not return the CodeForge SPA document.');
  const cacheControl = (appResponse.headers.get('cache-control') || '').toLowerCase();
  if (requireNoStoreHeaders && !cacheControl.includes('no-store') && !cacheControl.includes('no-cache')) {
    throw new Error('/app HTML must not be cached, otherwise Android can retain stale asset manifests.');
  }

  const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => new URL(match[1], origin).pathname)
    .filter(path => path.startsWith('/assets/'));
  const jsPaths = [...new Set(assetPaths.filter(path => /\.m?js$/i.test(path)))];
  const cssPaths = [...new Set(assetPaths.filter(path => /\.css$/i.test(path)))];
  if (jsPaths.length === 0 || cssPaths.length === 0) {
    throw new Error('/app did not reference both a JavaScript and CSS asset.');
  }

  const assets = [];
  for (const path of [...jsPaths, ...cssPaths]) {
    const response = await expectOk(fetchImpl, request(path), path, path.endsWith('.css') ? 'text/css' : 'javascript');
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (path.endsWith('.css') && !contentType.includes('text/css')) {
      throw new Error(path + ' returned an unexpected content type: ' + contentType);
    }
    if (/\.m?js$/i.test(path) && !contentType.includes('javascript')) {
      throw new Error(path + ' returned an unexpected content type: ' + contentType);
    }
    await response.arrayBuffer();
    assets.push({ path, contentType });
  }

  const healthResponse = await expectOk(fetchImpl, request('/api/health'), '/api/health', 'application/json');
  const health = await readJson(healthResponse, '/api/health');
  if (health.ok !== true || health.database !== 'connected') {
    throw new Error('/api/health did not report a connected database.');
  }

  const configResponse = await expectOk(fetchImpl, request('/api/config'), '/api/config', 'application/json');
  const config = await readJson(configResponse, '/api/config');
  if (typeof config.url !== 'string' || !config.url.startsWith('https://')
    || typeof config.publishableKey !== 'string' || config.publishableKey.length === 0) {
    throw new Error('/api/config did not return a valid public Supabase configuration.');
  }

  const authResponse = await fetchImpl(request('/api/workspaces'), {
    redirect: 'follow',
    headers: { accept: 'application/json' },
  });
  const authBody = await authResponse.text();
  if (authResponse.status !== 401 || !authBody.includes('Authentication required')) {
    throw new Error('/api/workspaces must reject an unauthenticated request with HTTP 401.');
  }

  return {
    rootRoute: { status: rootResponse.status, contentType: rootType },
    appRoute: { status: appResponse.status, contentType: appType, cacheControl },
    health,
    authGuard: { status: authResponse.status },
    assets,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  verifyHostedApp({ baseUrl: process.env.CODEFORGE_BASE_URL || DEFAULT_BASE_URL, requireNoStoreHeaders: process.env.REQUIRE_NO_STORE_HEADERS === 'true' })
    .then(result => {
      console.log('Hosted CodeForge routes, API guard, and static assets verified.');
      if (!result.appRoute.cacheControl.includes('no-store') && !result.appRoute.cacheControl.includes('no-cache')) {
        console.warn('The current deployment still serves cacheable /app HTML; the next approved production deployment must apply the no-store HTML policy.');
      }
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : 'Hosted CodeForge verification failed.');
      process.exitCode = 1;
    });
}
