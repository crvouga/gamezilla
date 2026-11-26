import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import {
  assertSecretsEnvBinding,
  postgresConnectionString,
  readDeploymentProtection,
  readOptionalDatabaseUrlOverride,
  workerEnvToSecretRecord,
} from '@libs/app-root-shared-ts/env';
import { ApiSecretName } from '@libs/app-root-shared-ts/secret-names';
import { createApiSecretStore } from '@libs/app-root-shared-ts/secret-store';
import type { ServerEnv } from '@libs/app-root-shared-ts/server-env';
import { wrapSqlClientForObservability } from '@libs/app-root-shared-ts/wrap-sql-client';
import { assertNonProdDatabaseUrl } from '@libs/db-shared-ts/database-url-policy';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { ConflictBackoff } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import { retryingConflicts } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import { createApiObjectStore } from './object-store';
import { openRequestDb } from './open-request-db-postgres';
import { drainAndNotifyOutbox } from './outbox-drain';

/** Sweeper for stranded outbox deliveries (cron). Opens its own DB session. */
export async function drainOutboxOnCron(
  env: ApiWorkerEnv,
  ports: {
    readonly consumers?: Pick<
      Parameters<typeof drainAndNotifyOutbox>[0],
      'consumerRegistry' | 'topicMap'
    >;
    readonly http: HttpClient;
    readonly clock: Clock;
    readonly createId: ServerEnv['createId'];
    /** Spreads reruns of transactions that lost a serialization conflict. */
    readonly backoff: ConflictBackoff;
  }
): Promise<number> {
  const { http, clock, createId, backoff } = ports;
  const secretsEnv = assertSecretsEnvBinding(env);
  const secretStore = createApiSecretStore(
    workerEnvToSecretRecord(env),
    clock.now
  );
  const override = readOptionalDatabaseUrlOverride(env);
  const dbUrl =
    override !== null && override.length > 0
      ? override
      : (await secretStore.getRequired(ApiSecretName.dbUrl)).readSecretValue();
  if (readDeploymentProtection(env) !== 'production') {
    await assertNonProdDatabaseUrl(dbUrl, {
      surface: 'api-worker-cron',
      secretsEnv,
    });
  }
  const opened = await openRequestDb(
    postgresConnectionString(env, dbUrl),
    appPostgresDbScope()
  );
  try {
    const processed = await drainAndNotifyOutbox({
      ...ports.consumers,
      pubsub:
        (await new HttpPubSubFromSecretStore(
          secretStore,
          clock.now,
          http
        ).get()) ?? null,
      objectStore: await createApiObjectStore(secretStore, {
        secretsEnv,
        now: clock.now,
        http,
      }),
      db: retryingConflicts(
        wrapSqlClientForObservability(opened.sqlClient),
        backoff
      ),
      clock,
      createId,
    });
    return processed;
  } finally {
    if (opened.kind === 'postgres') {
      await opened.pool.end();
    }
  }
}
