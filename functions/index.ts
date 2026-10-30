import { Hono } from 'hono';
import { cors } from 'hono/cors';
import d1Orders from './api/d1-orders';
import kvState from './api/kv-state';

const app = new Hono();

// Enable CORS for browser access from codeforge-ide.vasudevaya.workers.dev
app.use('*', cors());

// D1 Database API
app.get('/api/d1-orders', d1Orders.fetch);

// KV Namespace API
app.get('/api/kv-state', kvState.fetch);

// Static Asset Proxy (optional, if Worker serves static files)
// For CodeForge, static assets are served by Cloudflare Pages (apps/web/dist)
// but Worker can proxy or handle specific routes.

export default app;
