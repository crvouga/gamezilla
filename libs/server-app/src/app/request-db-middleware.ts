import { appAuth } from '@libs/auth/public/auth-context';
import { SessionAuth } from '@libs/auth/public/session-middleware';
import type { AuthContext } from '@libs/auth/public/types';
import type { DesiredClientConfig } from '@libs/client-config/root/server/ensure-client-config-materialized';
import { EnsureClientConfigMaterialized } from '@libs/client-config/root/server/ensure-client-config-materialized';
import { assertNonProdDatabaseUrl } from '@libs/db/public/database-url-policy';
import type { OpenSqlClient } from '@libs/feature/public/sync';
import { assert } from '@pkgs/assert';
import type { AuthServerPort } from '@pkgs/auth/server';
import type { Clock, Timers } from '@pkgs/clock';
import { KvImplPostgres } from '@pkgs/kv-postgres/impl-postgres';
import { ATTR, activeSpan, withSpan } from '@pkgs/observability/core';
import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import type { MiddlewareHandler } from 'hono';
import type { DeploymentProtection } from '../config/env';
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

/** Per middleware-instance latch (not process-global) for multi-app harnesses. */
type PolicyLatch = { checked: boolean };

/** Every non-production deployment refuses a production-looking database. */
async function ensureNonProductionDatabasePolicy(
  databaseUrl: string,
  protection: DeploymentProtection,
  latch: PolicyLatch
): Promise<void> {
  if (protection === 'production') return;
  if (latch.checked) return;
  await assertNonProdDatabaseUrl(databaseUrl, {
    surface: 'api-worker',
    protection,
  });
  latch.checked = true;
}

export type RequestDbMiddlewareOptions = {
  readonly authServer: AuthServerPort;
  readonly apiUrlOverride?: string | null | undefined;
  readonly databaseUrlOverride?: string | null | undefined;
  readonly protection: DeploymentProtection;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  /** Public client_config rows derived from Worker secrets at boot. */
  readonly desiredClientConfig: DesiredClientConfig;
  readonly openSqlClient: OpenSqlClient;
  readonly skipDatabaseUrlPolicy?: boolean;
};

type ClientConfigLatch = { done: boolean };

class ObservedSessionAuth extends SessionAuth {
  override async resolveAuthContext(
    db: SqlClient,
    request: Request
  ): Promise<Readonly<Record<string, unknown>>> {
    const context = await super.resolveAuthContext(db, request);
    const auth = appAuth(context);
    if (auth !== null) {
      activeSpan()?.setAttribute(ATTR.USER_ID, auth.accountId ?? auth.myId);
      activeSpan()?.setAttribute(ATTR.APP_DEVICE_ID, auth.deviceId);
    }
    return context;
  }
}

type AttachRequestDatabaseArgs = {
  readonly c: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[0];
  readonly next: Parameters<MiddlewareHandler<ApiHonoEnv<AuthContext>>>[1];
  readonly secretStore: SecretStore;
  readonly options: RequestDbMiddlewareOptions;
  readonly clientConfigLatch: ClientConfigLatch;
};

async function openObservedSqlClient(
  openSqlClient: OpenSqlClient
): Promise<SqlClient> {
  return withSpan('db.open', () => openSqlClient(), {
    [ATTR.DB_SYSTEM_NAME]: 'postgresql',
    [ATTR.CODE_FILE_PATH]: 'libs/server-app/src/app/request-db-middleware.ts',
    [ATTR.CODE_FUNCTION_NAME]: 'openObservedSqlClient',
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
  const { authServer, clock, timers, createId } = options;
  const raw = await openObservedSqlClient(options.openSqlClient);
  const sqlClient = wrapSqlClientForObservability(raw);
  const kv = new KvImplPostgres(sqlClient, clock.now);
  const sessionAuth = new ObservedSessionAuth(authServer, {
    clock,
    createId,
  });
  const store = {
    sqlClient,
    sessionAuth,
    kv,
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
        await withSpan('db.disconnect', () => Promise.reject(error), {
          [ATTR.DB_SYSTEM_NAME]: 'postgresql',
          [ATTR.CODE_FILE_PATH]:
            'libs/server-app/src/app/request-db-middleware.ts',
          [ATTR.CODE_FUNCTION_NAME]: 'disconnect',
        }).catch(() => undefined);
      }
    }
  });
}

export function createRequestDbMiddleware(
  secretStore: SecretStore,
  options: RequestDbMiddlewareOptions
): MiddlewareHandler<ApiHonoEnv<AuthContext>> {
  const { databaseUrlOverride = null, protection } = options;
  const policyLatch: PolicyLatch = { checked: false };
  const clientConfigLatch: ClientConfigLatch = { done: false };
  const skipDatabasePolicy = options.skipDatabaseUrlPolicy === true;
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (path === '/api/health' || path === '/api/observability/v1/traces') {
      return next();
    }
    if (!skipDatabasePolicy) {
      const dbUrl = await resolveRequestDatabaseUrl(
        secretStore,
        databaseUrlOverride
      );
      assert.nonEmptyString(dbUrl, 'DATABASE_URL must be a non-empty string');
      await ensureNonProductionDatabasePolicy(dbUrl, protection, policyLatch);
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
