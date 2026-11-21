'use strict';

/**
 * @param {string} value
 * @param {string} codeForgeOrigin
 * @returns {'codeforge-app' | 'external-https' | 'invalid'}
 */
exports.classifyWebViewNavigation = function classifyWebViewNavigation(value, codeForgeOrigin) {
  try {
    const url = new URL(value);
    const expectedOrigin = new URL(codeForgeOrigin).origin;

    // Never send credential-bearing HTTPS URLs to the WebView, including OAuth/provider URLs.
    if (url.username || url.password) return 'invalid';

    if (
      url.origin === expectedOrigin
      && (url.pathname === '/app' || url.pathname.startsWith('/app/'))
    ) {
      return 'codeforge-app';
    }

    return url.protocol === 'https:' ? 'external-https' : 'invalid';
  } catch {
    return 'invalid';
  }
};
