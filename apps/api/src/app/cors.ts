import { cors } from 'hono/cors';

/**
 * CORS for browser / Expo web clients calling the API.
 *
 * Token-only auth: the API never reads or sets cookies. All identity
 * travels via `Authorization: Bearer …` (or the `x-anon-id` header for
 * anonymous patch-db clients). Because no credentials are sent, the
 * origin can safely be `*`.
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
  credentials: false,
});
