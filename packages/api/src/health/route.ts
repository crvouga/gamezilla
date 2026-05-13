import { Hono } from 'hono';

export const healthApp = new Hono()
  /** GET `/health` — liveness for load balancers and deploy checks. */
  .get('/health', (c) => c.json({ status: 'ok' }, 200));
