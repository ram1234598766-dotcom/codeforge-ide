const DEFAULT_BASE_URL = 'https://codeforge-ide.vasudevaya.workers.dev';
const REQUEST_TIMEOUT_MS = 15_000;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(response, path) {
  try {
    return await response.json();
  } catch {
    throw new Error(\`\${path} did not return valid JSON.\`);
  }
}

export async function verifyHostedApp({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const base = new URL(baseUrl);
  ensure(base.protocol === 'https:', 'The CodeForge production origin must use HTTPS.');

  async function request(path) {
    const url = new URL(path, base);
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { accept: '*/*' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    ensure(response.ok, \`\${path} returned HTTP \${response.status}.\`);
    return response;
  }

  async function htmlRoute(path) {
    const response = await request(path);
    const contentType = response.headers.get('content-type') || '';
    ensure(contentType.toLowerCase().includes('text/html'), \`\${path} did not return text/html.\`);
    const cacheControl = response.headers.get('cache-control') || '';
    ensure(/no-store/i.test(cacheControl), \`\${path} HTML is cacheable; mobile clients could keep a stale OAuth/app shell.\`);
    const html = await response.text();
    ensure(/<div[^>]+id=["']root["']/.test(html), \`\${path} is missing the SPA root element.\`);
    return { status: response.status, html };
  }

  const homeRoute = await htmlRoute('/');
  const appRoute = await htmlRoute('/app');
  const assetCandidates = new Set();
  const assetPattern = /\b(?:src|href)=["']([^"']+\.(?:m?js|css)(?:\?[^"']*)?)["']/gi;
  for (const html of [homeRoute.html, appRoute.html]) {
    for (const match of html.matchAll(assetPattern)) {
      const assetUrl = new URL(match[1], base);
      if (assetUrl.origin === base.origin) assetCandidates.add(assetUrl.pathname + assetUrl.search);
    }
  }
  ensure(assetCandidates.size > 0, 'The SPA HTML did not reference any same-origin JavaScript or CSS assets.');
  const assets = [];
  for (const path of [...assetCandidates].sort()) {
    const response = await request(path);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (/\.css(?:\?|$)/i.test(path)) {
      ensure(contentType.includes('text/css'), \`\${path} did not return a CSS content type.\`);
    } else {
      ensure(contentType.includes('javascript') || contentType.includes('ecmascript'), \`\${path} did not return a JavaScript content type.\`);
    }
    assets.push({ path, status: response.status, contentType });
  }

  const healthResponse = await request('/api/health');
  const health = await readJson(healthResponse, '/api/health');
  ensure(health.ok === true && health.database === 'connected', '/api/health reports an unavailable database.');
  const configResponse = await request('/api/config');
  const config = await readJson(configResponse, '/api/config');
  let projectUrl;
  try {
    projectUrl = new URL(config.url);
  } catch {
    throw new Error('/api/config did not expose a valid Supabase project URL.');
  }
  ensure(projectUrl.protocol === 'https:' && typeof config.publishableKey === 'string' && config.publishableKey.length > 0,
    '/api/config is missing its HTTPS URL or public publishable key.');

  const authResponse = await fetchImpl(new URL('/api/workspaces', base), {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  ensure(authResponse.status === 401, '/api/workspaces must reject an unauthenticated request with HTTP 401.');
  const authPayload = await readJson(authResponse, '/api/workspaces');
  ensure(authPayload.error === 'Authentication required', '/api/workspaces did not return the expected authentication guard.');

  return {
    origin: base.origin,
    homeRoute: { status: homeRoute.status },
    appRoute: { status: appRoute.status },
    assets,
    health: { ok: health.ok, database: health.database },
    config: { configured: true, projectHost: projectUrl.host },
    authGuard: { status: authResponse.status },
  };
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  try {
    const result = await verifyHostedApp({ baseUrl: process.env.CODEFORGE_BASE_URL || DEFAULT_BASE_URL });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Hosted CodeForge smoke test failed.');
    process.exitCode = 1;
  }
}
