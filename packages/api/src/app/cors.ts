import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

import { tryBetterAuthOptionsResponse } from '@gamezilla/auth/server/better-auth-cors';

export { tryBetterAuthOptionsResponse };

/**
 * CORS for browser / Expo web clients calling the API.
 *
 * No cookies: identity uses `Authorization: Bearer …` (hosted auth session token) plus
 * `x-anon-id` (install UUID for device binding), or anonymous `x-anon-id` only.
 * Because `credentials` stays false, the origin can safely be `*`.
 *
 * Do **not** set a fixed `allowHeaders` list: Hono only mirrors
 * `Access-Control-Request-Headers` from the browser when `allowHeaders` is empty.
 * Better Auth (and other clients) send additional headers on preflight; a short static
 * list makes the browser reject OPTIONS before the real request runs.
 */
const innerApiCors = cors({
  origin: '*',
  exposeHeaders: ['set-auth-token'],
  credentials: false,
});

export const apiCors: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;
  if (path.includes('/api/auth')) {
    await next();
    return;
  }
  return innerApiCors(c, next);
};
