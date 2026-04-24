import { cors } from 'hono/cors';

/** CORS for browser / Expo web clients calling the API. */
export const apiCors = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Cache-Control', 'Pragma', 'Authorization'],
});
