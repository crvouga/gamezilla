import { Hono } from 'hono';
import type { ApiHonoEnv } from '@gamezilla/api/app/api-hono-types';
import type { SessionAuth } from './session-middleware';
import { UnauthorizedError } from './unauthorized-error';

export type { SessionAuth };

/**
 * Authenticated identity introspection for clients after hosted sign-in.
 * Requires `Authorization: Bearer` (session JWT) and `x-anon-id` (install UUID).
 */
export function createAuthApiRoutes() {
  return new Hono<ApiHonoEnv>().get('/auth/whoami', async (c) => {
    const db = c.get('patchDb');
    const sessionAuth = c.get('sessionAuth');
    try {
      const auth = await sessionAuth.requireAuthContext(db, c.req.raw);
      return c.json({ accountId: auth.accountId }, 200);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return c.json({ error: err.message }, 401);
      }
      throw err;
    }
  });
}
