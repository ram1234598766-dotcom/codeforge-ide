import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Allow Cloudflare Pages preview host/origin
    cors: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: '/index.html',
      },
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"https://rbgnjcquiqszkeiumueo.supabase.co"',
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '"sb_publishable_a32yW-Ajq9KHgCDQoUBogg_yGOv3wXk"',
    'import.meta.env.VITE_D1_BINDING': '"CODEFORGE_DB"',
    'import.meta.env.VITE_KV_BINDING': '"CODEFORGE_KV"',
  },
});
