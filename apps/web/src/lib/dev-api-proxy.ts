export const DEFAULT_CODEFORGE_API_PROXY_TARGET = 'https://codeforge-ide.vasudevaya.workers.dev';

export function getDevApiProxyTarget(override?: string): string {
  const candidate = override?.trim() || DEFAULT_CODEFORGE_API_PROXY_TARGET;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('The CodeForge API proxy target must be a valid HTTP(S) URL.');
  }

  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname || url.username || url.password) {
    throw new Error('The CodeForge API proxy target must be a valid HTTP(S) URL without credentials.');
  }

  return url.origin;
}

export function createDevApiProxyConfig(override?: string) {
  return {
    '/api': {
      target: getDevApiProxyTarget(override),
      changeOrigin: true,
      secure: true,
    },
  };
}
