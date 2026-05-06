import type { PatchDb } from '@gamezilla/patch-db/interface';
import { Hono } from 'hono';
import type { ApiWorkerEnv } from '../config/env';
import type { createSessionAuth } from './session-middleware';
import { UnauthorizedError } from './unauthorized-error';

export type SessionAuth = ReturnType<typeof createSessionAuth>;

/**
 * Authenticated identity introspection for clients after hosted sign-in.
 * Requires `Authorization: Bearer` (session JWT) and `x-anon-id` (install UUID).
 */
export function createAuthApiRoutes(db: PatchDb, sessionAuth: SessionAuth) {
  return new Hono<{ Bindings: ApiWorkerEnv }>().get(
    '/auth/whoami',
    async (c) => {
      try {
        const auth = await sessionAuth.requireAuthContext(db, c.req.raw);
        return c.json({ accountId: auth.accountId }, 200);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          return c.json({ error: err.message }, 401);
        }
        throw err;
      }
    }
  );
}
