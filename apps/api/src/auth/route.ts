import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { ApiWorkerEnv } from '../config/env';
import { ApiSecretName } from '../config/secret-names';
import { handleAuthClaimResult } from './claim-handler';
import { authClaimRequestSchema } from './schema';

/** POST `/auth/claim` — Google id_token + principal binding. */
export function createAuthClaimApp(db: PatchesDb, secretStore: SecretStore) {
  return new Hono<{ Bindings: ApiWorkerEnv }>().post(
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
  );
}
