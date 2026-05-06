import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { ApiWorkerEnv } from '../config/env';
import { ApiSecretName } from '../config/secret-names';
import { handleAuthClaimResult } from './claim-handler';
import { authClaimRequestSchema } from './schema';
import { handleSignOut, parseBearerFromRequest } from './sign-out-handler';

/**
 * Auth routes: claim and sign-out. Token-only — the API never reads or sets
 * cookies. Anonymous patch-db identity is the device UUID supplied by the
 * client via `x-anon-id`; there is no server-issued client id to fetch.
 */
export function createAuthClaimApp(db: PatchDb, secretStore: SecretStore) {
  return new Hono<{ Bindings: ApiWorkerEnv }>()
    .post(
      '/auth/claim',
      zValidator('json', authClaimRequestSchema),
      async (c) => {
        const body = c.req.valid('json');
        const googleClientId = await secretStore.getOptional(
          ApiSecretName.googleWebClientId
        );
        const authOpts = googleClientId !== null ? { googleClientId } : {};
        const result = await handleAuthClaimResult(db, body, authOpts);
        return c.json(result.json, result.status);
      }
    )
    .post('/auth/sign-out', async (c) => {
      const bearer = parseBearerFromRequest(c.req.raw);
      const result = await handleSignOut({ db, bearer });
      if (result.status === 204) {
        return c.body(null, 204);
      }
      return c.json(result.json, result.status);
    });
}
