import { createBetterAuthRequestStack } from '@libs/auth/server/better-auth-create';
import { createSessionAuth } from '@libs/auth/server/session-middleware';
import type { AuthContext } from '@libs/auth/server/types';
import { assert } from '@pkgs/assert';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { SecretStore } from '@pkgs/secret-store';
import { gamezillaPostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { MiddlewareHandler } from 'hono';
import { ApiSecretName } from '../config/secret-names';
import { createMatchmakingSqlClientFromNeonClient } from '../matchmaking/sql-client-adapter';
import { createRequestPatchDb } from '../patch-db/patch-db';
import { openRequestDb } from '../patch-db/sql-client';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import type { ApiHonoEnv } from './api-hono-types';

/**
 * Per-request Neon Postgres + Better Auth + session auth (AsyncLocalStorage for patch-db host).
 */
export function createRequestDbMiddleware(
  secretStore: SecretStore,
  apiUrlOverride?: string | null
): MiddlewareHandler<ApiHonoEnv<AuthContext>> {
  return async (c, next) => {
    if (c.req.path === '/health') {
      return next();
    }

    const dbUrl = (
      await secretStore.getRequired(ApiSecretName.dbUrl)
    ).readSecretValue();
    assert.nonEmptyString(dbUrl, 'DATABASE_URL must be a non-empty string');

    const dbScope = gamezillaPostgresDbScope();
    const { neonClient, sqlClient } = await openRequestDb(dbUrl, dbScope);
    const patchDb = createRequestPatchDb(sqlClient);
    // The `kv` table is created by API DB migrations (`KvImplPostgres.migrateUp`
    // in `run-postgres-migrations.ts`) in the `gamezilla` schema, which every
    // connection's `search_path` is pinned to. Never run DDL on every request.
    const kv = new KvImplPostgres(sqlClient);
    const matchmakingSqlClient =
      createMatchmakingSqlClientFromNeonClient(neonClient);
    const { auth: betterAuth, dispose } = await createBetterAuthRequestStack(
      secretStore,
      dbUrl,
      { dbScope, apiUrlOverride: apiUrlOverride ?? null }
    );
    const sessionAuth = createSessionAuth({ auth: betterAuth });

    const store = {
      patchDb,
      sessionAuth,
      kv,
      matchmakingSqlClient,
    };
    return await apiRequestAsyncLocalStorage.run(store, async () => {
      c.set('patchDb', patchDb);
      c.set('sessionAuth', sessionAuth);
      c.set('betterAuth', betterAuth);
      try {
        await next();
      } finally {
        c.executionCtx.waitUntil(
          (async () => {
            await dispose().catch(() => {});
            await sqlClient.disconnect().catch(() => {});
          })()
        );
      }
    });
  };
}
