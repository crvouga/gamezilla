import { SessionAuth } from '@libs/auth/public/session-middleware';
import type { AuthContext } from '@libs/auth/public/types';
import type { DesiredClientConfig } from '@libs/client-config/root/server/ensure-client-config-materialized';
import { EnsureClientConfigMaterialized } from '@libs/client-config/root/server/ensure-client-config-materialized';
import {
  assertDatabaseUrlAllowedForSecretsEnv,
  DEVELOPMENT_SECRETS_ENV,
} from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';
import {
  type BetterAuthInstance,
  createBetterAuth,
  createBetterAuthServerAdapter,
} from '@pkgs/auth-better-auth/server';
import type { Io } from '@pkgs/io';
import { runWithIo } from '@pkgs/io/als';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import { isObservabilityActive } from '@pkgs/observability/port/is-observability-active';
import type { Observability } from '@pkgs/observability/port/observability';
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import type { MiddlewareHandler } from 'hono';
import {
  type BetterAuthBootConfig,
  betterAuthConfigForDatabase,
} from '../config/better-auth-boot';
import { ApiSecretName } from '../config/secret-names';
import type { OpenRequestDb, RequestDb } from '../db/open-request-db';
import { wrapSqlClientForObservability } from '../observability/wrap-sql-client';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { notifyClientConfigChannels } from '../sync/notify-client-config-channels';
import type { ApiHonoEnv } from './api-hono-types';

/** Per-request Postgres + session auth (AsyncLocalStorage). */
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

/** Per middleware-instance latch (not process-global) for multi-app sims. */
type PolicyLatch = { checked: boolean };

async function ensureDevDatabasePolicy(
  databaseUrl: string,
  secretsEnv: string,
  latch: PolicyLatch
): Promise<void> {
  if (secretsEnv !== DEVELOPMENT_SECRETS_ENV) return;
  if (latch.checked) return;
  await assertDatabaseUrlAllowedForSecretsEnv(databaseUrl, secretsEnv, {
    surface: 'api-worker',
  });
  latch.checked = true;
}

export type RequestDbMiddlewareOptions = {
  readonly betterAuth: BetterAuthBootConfig;
  readonly apiUrlOverride?: string | null | undefined;
  readonly databaseUrlOverride?: string | null | undefined;
  readonly secretsEnv: string;
  readonly observability: Observability;
  /** Process-level Io from the API composition root. */
  readonly io: Io;
  /** Public client_config rows derived from Worker secrets at boot. */
  readonly desiredClientConfig: DesiredClientConfig;
  /** Injected DB opener (Postgres wall adapter or sim SQLite). */
  readonly openRequestDb: OpenRequestDb;
  /** Sims skip non-prod DATABASE_URL policy checks. */
  readonly skipDatabaseUrlPolicy?: boolean;
};

type ClientConfigLatch = { done: boolean };

type AttachRequestDatabaseArgs = {
  readonly c: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[0];
  readonly next: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[1];
  readonly secretStore: SecretStore;
  readonly dbScope: PostgresDbScope;
  readonly dbUrl: string;
  readonly options: RequestDbMiddlewareOptions;
  readonly clientConfigLatch: ClientConfigLatch;
};

async function openObservedRequestDb(
  observability: Observability,
  dbUrl: string,
  dbScope: PostgresDbScope,
  openDb: OpenRequestDb
): Promise<RequestDb> {
  if (!isObservabilityActive(observability)) {
    return openDb(dbUrl, dbScope);
  }
  const span = observability.startSpan({
    name: 'db.open',
    kind: 'internal',
  });
  return observability.withSpanContextAsync(span.spanContext, async () => {
    try {
      const db = await openDb(dbUrl, dbScope);
      span.setStatus({ code: 'ok' });
      return db;
    } catch (err: unknown) {
      observability.recordException(err);
      span.setStatus({
        code: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

function createRequestBetterAuth(
  boot: BetterAuthBootConfig,
  opened: RequestDb
): BetterAuthInstance {
  const database =
    opened.kind === 'postgres'
      ? ({ kind: 'postgres', pool: opened.pool } as const)
      : ({ kind: 'sql-client', client: opened.sqlClient } as const);
  return createBetterAuth(betterAuthConfigForDatabase(boot, database));
}

async function materializeClientConfigIfNeeded(
  sqlClient: SqlClient,
  options: RequestDbMiddlewareOptions,
  latch: ClientConfigLatch
): Promise<void> {
  if (latch.done) return;
  // Never share an in-flight Promise across requests — Workers cancels the
  // waiter ("hung and would never generate a response"). Concurrent first
  // requests may both materialize; EnsureClientConfigMaterialized is idempotent.
  const result = await new EnsureClientConfigMaterialized(
    sqlClient,
    options.io
  ).execute(options.desiredClientConfig);
  latch.done = true;
  if (result.updated) {
    await notifyClientConfigChannels('client-config-materialize');
  }
}

async function attachRequestDatabase(
  args: AttachRequestDatabaseArgs
): Promise<Response | void> {
  const { c, next, dbScope, dbUrl, options, secretStore, clientConfigLatch } =
    args;
  const { betterAuth: boot, observability, io } = options;
  const openDb = options.openRequestDb;
  const opened = await openObservedRequestDb(
    observability,
    dbUrl,
    dbScope,
    openDb
  );
  const sqlClient = wrapSqlClientForObservability(
    observability,
    opened.sqlClient
  );
  const betterAuth = createRequestBetterAuth(boot, opened);
  const authServer = createBetterAuthServerAdapter(betterAuth);
  const kv = new KvImplPostgres(sqlClient, io.clock.now);
  const sessionAuth = new SessionAuth(authServer);
  const store = {
    sqlClient,
    sessionAuth,
    kv,
    observability,
    secretStore,
    betterAuth,
    io,
  };
  return await runWithIo(io, () =>
    apiRequestAsyncLocalStorage.run(store, async () => {
      c.set('sqlClient', sqlClient);
      c.set('sessionAuth', sessionAuth);
      c.set('authServer', authServer);
      c.set('betterAuth', betterAuth);
      try {
        await materializeClientConfigIfNeeded(
          sqlClient,
          options,
          clientConfigLatch
        );
        return await next();
      } finally {
        // SQLite openers own process-lifetime handles (sim sqlite-mem / better-sqlite3).
        // Disconnecting here DROP/closes them after the first request.
        if (opened.kind === 'postgres') {
          // One end only — sqlClient and pool wrap the same pg.Client.
          try {
            await opened.pool.end();
          } catch (error: unknown) {
            observability.recordException(error, {
              operation: 'request-db-cleanup',
            });
          }
        }
      }
    })
  );
}

export function createRequestDbMiddleware(
  secretStore: SecretStore,
  dbScope: PostgresDbScope,
  options: RequestDbMiddlewareOptions
): MiddlewareHandler<ApiHonoEnv<AuthContext>> {
  const { databaseUrlOverride = null, secretsEnv } = options;
  const policyLatch: PolicyLatch = { checked: false };
  const clientConfigLatch: ClientConfigLatch = { done: false };
  const skipDatabasePolicy = options.skipDatabaseUrlPolicy === true;
  return async (c, next) => {
    if (new URL(c.req.url).pathname === '/api/health') {
      return next();
    }
    const dbUrl = await resolveRequestDatabaseUrl(
      secretStore,
      databaseUrlOverride
    );
    assert.nonEmptyString(dbUrl, 'DATABASE_URL must be a non-empty string');
    if (!skipDatabasePolicy) {
      await ensureDevDatabasePolicy(dbUrl, secretsEnv, policyLatch);
    }
    return attachRequestDatabase({
      c,
      next,
      secretStore,
      dbScope,
      dbUrl,
      options,
      clientConfigLatch,
    });
  };
}
