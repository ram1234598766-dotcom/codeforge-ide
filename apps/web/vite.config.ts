import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createDevApiProxyConfig } from './src/lib/dev-api-proxy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      cors: true,
      // Keep local OAuth callbacks on the same origin while forwarding Worker
      // config and authenticated API requests to the selected CodeForge backend.
      proxy: createDevApiProxyConfig(env.VITE_CODEFORGE_API_PROXY_TARGET),
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
