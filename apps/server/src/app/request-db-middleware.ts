import { SessionAuth } from '@libs/auth/public/session-middleware';
import type { AuthContext } from '@libs/auth/public/types';
import type { DesiredClientConfig } from '@libs/client-config/root/server/ensure-client-config-materialized';
import { EnsureClientConfigMaterialized } from '@libs/client-config/root/server/ensure-client-config-materialized';
import {
  assertDatabaseUrlAllowedForSecretsEnv,
  DEVELOPMENT_SECRETS_ENV,
} from '@libs/db/public/database-url-policy';
import type { OpenSqlClient } from '@libs/runtime/shared/env';
import { assert } from '@pkgs/assert';
import { createAuthServerAdapter } from '@pkgs/auth/server';
import type { Clock, Timers } from '@pkgs/clock';
import { KvImplPostgres } from '@pkgs/kv/impl-postgres';
import { isObservabilityActive } from '@pkgs/observability/port/is-observability-active';
import type { Observability } from '@pkgs/observability/port/observability';
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import type { MiddlewareHandler } from 'hono';
import type { AuthBootConfig } from '../config/auth-boot';
import { ApiSecretName } from '../config/secret-names';
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
  readonly auth: AuthBootConfig;
  readonly apiUrlOverride?: string | null | undefined;
  readonly databaseUrlOverride?: string | null | undefined;
  readonly secretsEnv: string;
  readonly observability: Observability;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  /** Public client_config rows derived from Worker secrets at boot. */
  readonly desiredClientConfig: DesiredClientConfig;
  readonly openSqlClient: OpenSqlClient;
  readonly skipDatabaseUrlPolicy?: boolean;
};

type ClientConfigLatch = { done: boolean };

type AttachRequestDatabaseArgs = {
  readonly c: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[0];
  readonly next: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[1];
  readonly secretStore: SecretStore;
  readonly options: RequestDbMiddlewareOptions;
  readonly clientConfigLatch: ClientConfigLatch;
};

async function openObservedSqlClient(
  observability: Observability,
  openSqlClient: OpenSqlClient
): Promise<SqlClient> {
  if (!isObservabilityActive(observability)) {
    return openSqlClient();
  }
  const span = observability.startSpan({
    name: 'db.open',
    kind: 'internal',
  });
  return observability.withSpanContextAsync(span.spanContext, async () => {
    try {
      const db = await openSqlClient();
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
    options.clock
  ).execute(options.desiredClientConfig);
  latch.done = true;
  if (result.updated) {
    await notifyClientConfigChannels('client-config-materialize');
  }
}

async function attachRequestDatabase(
  args: AttachRequestDatabaseArgs
): Promise<Response | void> {
  const { c, next, options, secretStore, clientConfigLatch } = args;
  const { auth: boot, observability, clock, timers, createId } = options;
  const raw = await openObservedSqlClient(observability, options.openSqlClient);
  const sqlClient = wrapSqlClientForObservability(observability, raw);
  const authServer = createAuthServerAdapter({
    getSql: () => sqlClient,
    clock,
    createId,
    secret: boot.secret,
  });
  const kv = new KvImplPostgres(sqlClient, clock.now);
  const sessionAuth = new SessionAuth(authServer, { clock, createId });
  const store = {
    sqlClient,
    sessionAuth,
    kv,
    observability,
    secretStore,
    clock,
    timers,
    createId,
  };
  return await apiRequestAsyncLocalStorage.run(store, async () => {
    c.set('sqlClient', sqlClient);
    c.set('sessionAuth', sessionAuth);
    c.set('authServer', authServer);
    try {
      await materializeClientConfigIfNeeded(
        sqlClient,
        options,
        clientConfigLatch
      );
      return await next();
    } finally {
      if (options.skipDatabaseUrlPolicy === true) return;
      try {
        await sqlClient.disconnect();
      } catch (error: unknown) {
        observability.recordException(error, {
          operation: 'request-db-cleanup',
        });
      }
    }
  });
}

export function createRequestDbMiddleware(
  secretStore: SecretStore,
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
    if (!skipDatabasePolicy) {
      const dbUrl = await resolveRequestDatabaseUrl(
        secretStore,
        databaseUrlOverride
      );
      assert.nonEmptyString(dbUrl, 'DATABASE_URL must be a non-empty string');
      await ensureDevDatabasePolicy(dbUrl, secretsEnv, policyLatch);
    }
    return attachRequestDatabase({
      c,
      next,
      secretStore,
      options,
      clientConfigLatch,
    });
  };
}
