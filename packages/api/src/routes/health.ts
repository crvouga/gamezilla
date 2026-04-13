import type { Hono } from 'hono';

export function registerHealth(app: Hono): void {
  app.get('/health', (c) => c.json({ status: 'ok' }));
}
