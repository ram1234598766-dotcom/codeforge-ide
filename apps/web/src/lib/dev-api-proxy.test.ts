import { describe, expect, it } from 'vitest';
import { createDevApiProxyConfig, DEFAULT_CODEFORGE_DEV_PORT, getDevApiProxyTarget } from './dev-api-proxy';

describe('local API proxy', () => {
  it('uses the locally allowlisted callback port by default', () => {
    expect(DEFAULT_CODEFORGE_DEV_PORT).toBe(3000);
  });
  it('defaults local API requests to the deployed CodeForge Worker', () => {
    expect(getDevApiProxyTarget()).toBe('https://codeforge-ide.vasudevaya.workers.dev');
  });

  it('allows a dedicated staging or local Worker target', () => {
    expect(getDevApiProxyTarget('https://codeforge-staging.example.workers.dev/'))
      .toBe('https://codeforge-staging.example.workers.dev');
    expect(getDevApiProxyTarget('http://127.0.0.1:8787'))
      .toBe('http://127.0.0.1:8787');
  });

  it('rejects non-HTTP API proxy targets', () => {
    expect(() => getDevApiProxyTarget('javascript:alert(1)'))
      .toThrow('HTTP(S)');
  });

  it('proxies every same-origin API route without rewriting its path', () => {
    expect(createDevApiProxyConfig()).toEqual({
      '/api': {
        target: 'https://codeforge-ide.vasudevaya.workers.dev',
        changeOrigin: true,
        secure: true,
      },
    });
  });
});
