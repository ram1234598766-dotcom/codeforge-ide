/**
 * Make the hosted SPA shell revalidate on every navigation so browsers do not
 * keep an old login bundle after an OAuth callback fix is deployed. Only HTML is
 * affected; hashed JS/CSS assets remain immutable and cacheable.
 */
export function preventHtmlAssetCaching(response: Response): Response {
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('cdn-cache-control', 'no-store');
  headers.set('cloudflare-cdn-cache-control', 'no-store');
  headers.set('pragma', 'no-cache');
  headers.set('expires', '0');

  // Clear only the HTTP cache. Do not clear cookies, localStorage, the Supabase
  // PKCE verifier, or the user's existing authentication session.
  headers.set('clear-site-data', '"cache"');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
