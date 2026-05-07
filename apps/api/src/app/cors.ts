import { cors } from 'hono/cors';

/**
 * CORS for browser / Expo web clients calling the API.
 *
 * No cookies: identity uses `Authorization: Bearer …` (hosted auth session token) plus
 * `x-anon-id` (install UUID for device binding), or anonymous `x-anon-id` only.
 * Because `credentials` stays false, the origin can safely be `*`.
 */
export const apiCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Cache-Control',
    'Pragma',
    'Authorization',
    'x-anon-id',
  ],
  exposeHeaders: ['set-auth-token'],
  credentials: false,
});
