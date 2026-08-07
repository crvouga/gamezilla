import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

/**
 * CORS for browser / Expo web clients calling the API.
 *
 * No cookies: identity uses `Authorization: Bearer …` (auth session token) plus
 * `x-anon-id` (install UUID for device binding), or anonymous `x-anon-id` only.
 * Because `credentials` stays false, the origin can safely be `*`.
 *
 * Do **not** set a fixed `allowHeaders` list: Hono only mirrors
 * `Access-Control-Request-Headers` from the browser when `allowHeaders` is empty.
 */
export const apiCors: MiddlewareHandler = cors({
  origin: '*',
  exposeHeaders: ['set-auth-token', 'traceparent'],
  credentials: false,
});
