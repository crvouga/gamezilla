import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { handleAuthClaimResult } from './claim-handler';
import { authClaimRequestSchema } from './schema';

/** POST `/auth/claim` — Google id_token + principal binding. */
export function createAuthClaimApp(
  db: PatchesDb,
  authOpts: { googleClientId?: string }
) {
  return new Hono().post(
    '/auth/claim',
    zValidator('json', authClaimRequestSchema),
    async (c) => {
      const body = c.req.valid('json');
      const result = await handleAuthClaimResult(db, body, authOpts);
      return c.json(result.json, result.status);
    }
  );
}
