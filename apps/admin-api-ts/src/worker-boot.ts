// @io-wall-ok
// @api-wall-ok
import { createApiObjectStore } from '@libs/app-root-server-ts/object-store';
import { openRequestDb } from '@libs/app-root-server-ts/open-request-db-postgres';
import { drainOutboxOnCron } from '@libs/app-root-server-ts/outbox-cron';
import { pushChangedAuthUser } from '@libs/app-root-server-ts/push-changed-auth-user';
import { createAuthProvider } from '@libs/app-root-shared-ts/auth-provider';
import {
  type ApiWorkerEnv,
  postgresConnectionString,
  readAdminAccountIds,
  readDeploymentProtection,
  readOptionalApiUrlOverride,
  workerEnvToSecretRecord,
} from '@libs/app-root-shared-ts/env';
import { ApiSecretName } from '@libs/app-root-shared-ts/secret-names';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { ADMIN_APP } from '@libs/runtime-shared-ts/admin-subs';
import { ThrowingCrashHandler } from '@pkgs/assert-root-shared-ts/crash-handler-throwing';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { timerBackoff } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import { adminServers } from './admin-servers';
import { createAdminApi } from './server';

assert.registerCrashHandler(new ThrowingCrashHandler());

export async function bootAdminApi(env: ApiWorkerEnv) {
  const secrets = createApiSecretStore(
    workerEnvToSecretRecord(env),
    wallClock.now
  );
  const protection = readDeploymentProtection(env);
  const createId = () => crypto.randomUUID();
  const http = createGlobalHttpClient();
  const [auth, objectStore] = await Promise.all([
    createAuthProvider({
      module: INHOUSE_AUTH_PROVIDER,
      secretStore: secrets,
      protection,
      apiUrlOverride: readOptionalApiUrlOverride(env),
      clock: wallClock,
      createId,
      http,
      onUserChanged: pushChangedAuthUser,
    }),
    createApiObjectStore(secrets, {
      now: wallClock.now,
      http,
      requireCredentials: protection === 'production',
    }),
  ]);
  return createAdminApi(auth, secrets, {
    adminAccountIds: readAdminAccountIds(env),
    objectStore,
    protection,
    clock: wallClock,
    timers: wallTimers,
    random: Math.random,
    http,
    createId,
    openSqlClient: async () => {
      const url = (
        await secrets.getRequired(ApiSecretName.dbUrl)
      ).readSecretValue();
      return (
        await openRequestDb(
          postgresConnectionString(env, url),
          appPostgresDbScope()
        )
      ).sqlClient;
    },
  });
}

export async function drainAdminOutbox(env: ApiWorkerEnv): Promise<void> {
  await drainOutboxOnCron(env, {
    http: createGlobalHttpClient(),
    clock: wallClock,
    createId: () => crypto.randomUUID(),
    backoff: timerBackoff({
      setTimeout: (fn, ms) => wallTimers.setTimeout(fn, ms),
      random: Math.random,
    }),
    consumers: {
      consumerRegistry: adminServers.outboxConsumers,
      topicMap: ADMIN_APP.topicMap,
    },
  });
}
