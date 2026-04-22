import { Hono } from 'hono';

/** GET `/health` — liveness for load balancers and deploy checks. */
export const healthApp = new Hono().get('/health', (c) =>
  c.json({ status: 'ok' as const }, 200)
);
