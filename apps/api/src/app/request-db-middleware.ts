import { createBetterAuthRequestStack } from '@libs/auth/server/better-auth-create';
import { createSessionAuth } from '@libs/auth/server/session-middleware';
import type { AuthContext } from '@libs/auth/server/types';
import {
  assertDatabaseUrlAllowedForVaultConfig,
  DEVELOPMENT_VAULT_CONFIG,
} from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import type { SecretStore } from '@pkgs/secret-store';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import type { MiddlewareHandler } from 'hono';
import { ApiSecretName } from '../config/secret-names';
import { createMatchmakingSqlClientFromSqlClient } from '../matchmaking/sql-client-adapter';
import { createRequestPatchDb } from '../patch-db/patch-db';
import { openRequestDb } from '../patch-db/sql-client';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import type { ApiHonoEnv } from './api-hono-types';

/**
 * Per-request Postgres + Better Auth + session auth (AsyncLocalStorage for patch-db host).
 */
async function resolveRequestDatabaseUrl(
  secretStore: SecretStore,
  databaseUrlOverride?: string | null
): Promise<string> {
  const override = databaseUrlOverride?.trim();
  if (override !== undefined && override !== null && override.length > 0) {
    return override;
  }
  return (await secretStore.getRequired(ApiSecretName.dbUrl)).readSecretValue();
}

let devDatabasePolicyChecked = false;

async function ensureDevDatabasePolicy(
  databaseUrl: string,
  vaultConfig: string | null
): Promise<void> {
  if (vaultConfig !== DEVELOPMENT_VAULT_CONFIG) return;
  if (devDatabasePolicyChecked) return;
  await assertDatabaseUrlAllowedForVaultConfig(databaseUrl, vaultConfig, {
    surface: 'api-worker',
  });
  devDatabasePolicyChecked = true;
}

export type RequestDbMiddlewareOptions = {
  readonly apiUrlOverride?: string | null | undefined;
  readonly databaseUrlOverride?: string | null | undefined;
  readonly devIdpPort?: number | undefined;
  readonly vaultConfig?: string | null | undefined;
};

export function createRequestDbMiddleware(
  secretStore: SecretStore,
  dbScope: PostgresDbScope,
  options: RequestDbMiddlewareOptions = {}
): MiddlewareHandler<ApiHonoEnv<AuthContext>> {
  const {
    apiUrlOverride = null,
    databaseUrlOverride = null,
    devIdpPort,
    vaultConfig = null,
  } = options;
  return async (c, next) => {
    if (new URL(c.req.url).pathname === '/api/health') {
      return next();
    }

    const dbUrl = await resolveRequestDatabaseUrl(
      secretStore,
      databaseUrlOverride
    );
    assert.nonEmptyString(dbUrl, 'DATABASE_URL must be a non-empty string');
    await ensureDevDatabasePolicy(dbUrl, vaultConfig);

    const { sqlClient } = await openRequestDb(dbUrl, dbScope);
    const patchDb = createRequestPatchDb(sqlClient);
    // The `kv` table is created by API DB migrations (`KvImplPostgres.migrateUp`
    // in `run-postgres-migrations.ts`) in the application schema, which every
    // connection's `search_path` is pinned to. Never run DDL on every request.
    const kv = new KvImplPostgres(sqlClient);
    const matchmakingSqlClient =
      createMatchmakingSqlClientFromSqlClient(sqlClient);
    const { auth: betterAuth, dispose } = await createBetterAuthRequestStack(
      secretStore,
      dbUrl,
      {
        dbScope,
        apiUrlOverride,
        ...(devIdpPort !== undefined ? { devIdpPort } : {}),
      }
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
