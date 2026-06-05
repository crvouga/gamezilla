import { createBetterAuthRequestStack } from '@libs/auth/server/better-auth-create';
import { createSessionAuth } from '@libs/auth/server/session-middleware';
import type { AuthContext } from '@libs/auth/server/types';
import { assert } from '@pkgs/assert';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { SecretStore } from '@pkgs/secret-store';
import type { MiddlewareHandler } from 'hono';
import { ConfigurationError } from '../config/env';
import { createMatchmakingSqlClientFromPgClient } from '../matchmaking/sql-client-adapter';
import { createRequestPatchDb } from '../patch-db/patch-db';
import { openRequestDb } from '../patch-db/sql-client';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import type { ApiHonoEnv } from './api-hono-types';

/**
 * Per-request Hyperdrive Postgres + Better Auth + session auth (AsyncLocalStorage for patch-db host).
 */
export function createRequestDbMiddleware(
  secretStore: SecretStore,
  apiUrlOverride?: string | null
): MiddlewareHandler<ApiHonoEnv<AuthContext>> {
  return async (c, next) => {
    if (c.req.path === '/health') {
      return next();
    }

    const hyper = c.env.HYPERDRIVE;
    if (hyper === undefined || hyper === null) {
      throw new ConfigurationError(
        'HYPERDRIVE Worker binding is required (configure apps/api/wrangler.toml)'
      );
    }
    const cs = hyper.connectionString;
    assert.nonEmptyString(
      cs,
      'Hyperdrive connectionString must be a non-empty string'
    );

    const { client, sqlClient } = await openRequestDb(cs);
    const patchDb = createRequestPatchDb(sqlClient);
    // `public.kv` is created by API DB migrations (`KvImplPostgres.migrateUp` in
    // `run-postgres-migrations.ts`). Never run DDL on every request.
    const kv = new KvImplPostgres(sqlClient);
    const matchmakingSqlClient = createMatchmakingSqlClientFromPgClient(client);
    const { auth: betterAuth, dispose } = await createBetterAuthRequestStack(
      secretStore,
      cs,
      apiUrlOverride === undefined ? undefined : { apiUrlOverride }
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
        // Defer Postgres + Better Auth cleanup beyond the response.
        // `pg.Client.end()` does not resolve under Workers' `nodejs_compat`
        // socket emulation when peering with the local PGlite socket, so
        // awaiting it inline would block the Hono response forever.
        c.executionCtx.waitUntil(
          (async () => {
            await dispose().catch(() => {});
            await client.end().catch(() => {});
          })()
        );
      }
    });
  };
}
