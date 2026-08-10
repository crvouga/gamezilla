import { SessionAuth } from '@libs/auth/server/session-middleware';
import type { AuthContext } from '@libs/auth/server/types';
import type { DesiredClientConfig } from '@libs/client-config/server/ensure-client-config-materialized';
import { EnsureClientConfigMaterialized } from '@libs/client-config/server/ensure-client-config-materialized';
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
  betterAuthConfigForPool,
} from '../config/better-auth-boot';
import { ApiSecretName } from '../config/secret-names';
import { openRequestDb } from '../db/open-request-db';
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

let devDatabasePolicyChecked = false;

async function ensureDevDatabasePolicy(
  databaseUrl: string,
  secretsEnv: string
): Promise<void> {
  if (secretsEnv !== DEVELOPMENT_SECRETS_ENV) return;
  if (devDatabasePolicyChecked) return;
  await assertDatabaseUrlAllowedForSecretsEnv(databaseUrl, secretsEnv, {
    surface: 'api-worker',
  });
  devDatabasePolicyChecked = true;
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
};

type AttachRequestDatabaseArgs = {
  readonly c: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[0];
  readonly next: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[1];
  readonly secretStore: SecretStore;
  readonly dbScope: PostgresDbScope;
  readonly dbUrl: string;
  readonly options: RequestDbMiddlewareOptions;
};

async function openObservedRequestDb(
  observability: Observability,
  dbUrl: string,
  dbScope: PostgresDbScope
): Promise<Awaited<ReturnType<typeof openRequestDb>>> {
  if (!isObservabilityActive(observability)) {
    return openRequestDb(dbUrl, dbScope);
  }
  const span = observability.startSpan({
    name: 'db.open',
    kind: 'internal',
  });
  return observability.withSpanContextAsync(span.spanContext, async () => {
    try {
      const db = await openRequestDb(dbUrl, dbScope);
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
  pool: Awaited<ReturnType<typeof openRequestDb>>['pool']
): BetterAuthInstance {
  return createBetterAuth(betterAuthConfigForPool(boot, pool));
}

/** Once-per-isolate latch; re-entry safe via compare-before-write inside ensure. */
let clientConfigMaterializePromise: Promise<void> | null = null;

async function materializeClientConfigIfNeeded(
  sqlClient: SqlClient,
  options: RequestDbMiddlewareOptions
): Promise<void> {
  if (clientConfigMaterializePromise !== null) {
    await clientConfigMaterializePromise;
    return;
  }
  clientConfigMaterializePromise = (async () => {
    const result = await new EnsureClientConfigMaterialized(
      sqlClient,
      options.io
    ).execute(options.desiredClientConfig);
    if (result.updated) {
      notifyClientConfigChannels('client-config-materialize');
    }
  })();
  try {
    await clientConfigMaterializePromise;
  } catch (err: unknown) {
    clientConfigMaterializePromise = null;
    throw err;
  }
}

async function attachRequestDatabase(
  args: AttachRequestDatabaseArgs
): Promise<Response | void> {
  const { c, next, dbScope, dbUrl, options, secretStore } = args;
  const { betterAuth: boot, observability, io } = options;
  const opened = await openObservedRequestDb(observability, dbUrl, dbScope);
  const sqlClient = wrapSqlClientForObservability(
    observability,
    opened.sqlClient
  );
  const { pool } = opened;
  const betterAuth = createRequestBetterAuth(boot, pool);
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
        await materializeClientConfigIfNeeded(sqlClient, options);
        return await next();
      } finally {
        // Await close on the request path. Deferred `waitUntil` teardown left
        // thousands of CLOSE_WAIT/TIME_WAIT sockets under wrangler local boot
        // fan-out (ephemeral-port exhaustion → "proxy request failed").
        try {
          await Promise.all([sqlClient.disconnect(), pool.end()]);
        } catch (error: unknown) {
          observability.recordException(error, {
            operation: 'request-db-cleanup',
          });
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
  return async (c, next) => {
    if (new URL(c.req.url).pathname === '/api/health') {
      return next();
    }
    const dbUrl = await resolveRequestDatabaseUrl(
      secretStore,
      databaseUrlOverride
    );
    assert.nonEmptyString(dbUrl, 'DATABASE_URL must be a non-empty string');
    await ensureDevDatabasePolicy(dbUrl, secretsEnv);
    return attachRequestDatabase({
      c,
      next,
      secretStore,
      dbScope,
      dbUrl,
      options,
    });
  };
}
