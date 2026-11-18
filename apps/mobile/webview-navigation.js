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

    if (
      url.origin === expectedOrigin
      && !url.username
      && !url.password
      && (url.pathname === '/app' || url.pathname.startsWith('/app/'))
    ) {
      return 'codeforge-app';
    }

    return url.protocol === 'https:' ? 'external-https' : 'invalid';
  } catch {
    return 'invalid';
  }
};
