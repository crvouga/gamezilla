import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

/**
 * CORS for browser / Expo web clients calling the API.
 *
 * Better Auth’s web client always sends `credentials: 'include'` (OAuth state
 * cookies on the API origin). Browsers reject credentialed responses when
 * `Access-Control-Allow-Origin` is `*`, which surfaces as "Failed to fetch".
 * Reflect the request Origin and allow credentials so BA (and Bearer
 * `set-auth-token`) work cross-origin from Expo web.
 *
 * Do **not** set a fixed `allowHeaders` list: Hono only mirrors
 * `Access-Control-Request-Headers` from the browser when `allowHeaders` is empty.
 */
export const apiCors: MiddlewareHandler = cors({
  origin: (origin) => origin,
  exposeHeaders: ['set-auth-token', 'traceparent'],
  credentials: true,
});
