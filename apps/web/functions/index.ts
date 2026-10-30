import { Hono } from 'hono';
import { cors } from 'hono/cors';
import d1Orders from './api/d1-orders';
import kvState from './api/kv-state';

const app = new Hono();

// Enable CORS for browser access
app.use('*', cors());

// D1 Database API
app.get('/api/d1-orders', d1Orders.fetch);

// KV Namespace API
app.get('/api/kv-state', kvState.fetch);

export default app;
