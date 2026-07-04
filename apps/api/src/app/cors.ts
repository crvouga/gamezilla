import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

import { tryBetterAuthOptionsResponse } from '@libs/auth/server/better-auth-cors';

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
  exposeHeaders: ['set-auth-token', 'traceparent'],
  credentials: false,
});

/**
 * Better Auth mounts under `/api/auth/*` and applies browser CORS in
 * {@link withBetterAuthBrowserCorsForRequest}. Our custom `POST /api/auth/refresh`
 * is registered on the same prefix but is **not** handled by that wrapper — if
 * we skip `innerApiCors` for it, cross-origin clients (Expo web on :5174 → wrangler
 * on :8788) see an opaque "Failed to fetch" even when the worker returns 200.
 */
function shouldSkipInnerApiCors(path: string): boolean {
  if (!path.startsWith('/api/auth')) return false;
  return path !== '/api/auth/refresh';
}

export const apiCors: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;
  if (shouldSkipInnerApiCors(path)) {
    await next();
    return;
  }
  return innerApiCors(c, next);
};
