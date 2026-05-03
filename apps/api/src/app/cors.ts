import { cors } from 'hono/cors';

/**
 * CORS for browser / Expo web clients calling the API.
 * `credentials: true` is required so the clientId cookie is
 * included in cross-origin requests. With credentials, `origin`
 * cannot be `*` — the callback echoes back the request origin.
 */
export const apiCors = cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Cache-Control', 'Pragma', 'Authorization'],
  credentials: true,
});
