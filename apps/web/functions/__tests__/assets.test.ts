import { describe, expect, it } from 'vitest';
import { preventHtmlAssetCaching } from '../assets';

describe('hosted HTML asset cache policy', () => {
  it('prevents HTML entrypoints from being served from stale browser or CDN caches', async () => {
    const original = new Response('<!doctype html><html></html>', {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'etag': '"old-entrypoint"',
      },
    });

    const response = preventHtmlAssetCaching(original);

    expect(response.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate, max-age=0');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('clear-site-data')).toBe('"cache"');
    expect(response.headers.get('etag')).toBe('"old-entrypoint"');
    await expect(response.text()).resolves.toContain('<!doctype html>');
  });

  it('leaves hashed JavaScript and CSS assets cacheable', () => {
    const original = new Response('console.log("asset")', {
      headers: {
        'content-type': 'application/javascript',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });

    expect(preventHtmlAssetCaching(original)).toBe(original);
    expect(original.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('does not change an unsuccessful HTML response', () => {
    const original = new Response('not found', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    });

    expect(preventHtmlAssetCaching(original)).toBe(original);
  });
});
