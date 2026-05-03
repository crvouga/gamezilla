import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { ApiWorkerEnv } from '../config/env';
import { ApiSecretName } from '../config/secret-names';
import { handleAuthClaimResult } from './claim-handler';
import { authClaimRequestSchema } from './schema';

/**
 * Auth routes: claim, and readable `clientId` for per-device anonymous SQLite naming
 * (httpOnly cookie is not visible to Expo JS).
 */
export function createAuthClaimApp(db: PatchDb, secretStore: SecretStore) {
  return new Hono<{
    Bindings: ApiWorkerEnv;
    Variables: { clientId: string };
  }>()
    .get('/auth/client-id', (c) => {
      return c.json({ clientId: c.var.clientId });
    })
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
    );
}
