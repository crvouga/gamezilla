import { createApiObjectStore } from '@libs/app-root-server/object-store';
import { openRequestDb } from '@libs/app-root-server/open-request-db-postgres';
import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import type { ApiWorkerEnv } from '@libs/app-root-shared/env';
import {
  assertSecretsEnvBinding,
  postgresConnectionString,
  readDeploymentProtection,
  readOptionalDatabaseUrlOverride,
  workerEnvToSecretRecord,
} from '@libs/app-root-shared/env';
import { ApiSecretName } from '@libs/app-root-shared/secret-names';
import { createApiSecretStore } from '@libs/app-root-shared/secret-store';
import type { ServerEnv } from '@libs/app-root-shared/server-env';
import { wrapSqlClientForObservability } from '@libs/app-root-shared/wrap-sql-client';
import { assertNonProdDatabaseUrl } from '@libs/db-shared/database-url-policy';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import type { Clock } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';

/** Sweeper for stranded outbox deliveries (cron). Opens its own DB session. */
export async function drainOutboxOnCron(
  env: ApiWorkerEnv,
  http: HttpClient,
  clock: Clock,
  createId: ServerEnv['createId']
): Promise<number> {
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
      objectStore: await createApiObjectStore(secretStore, {
        secretsEnv,
        now: clock.now,
        http,
      }),
      db: wrapSqlClientForObservability(opened.sqlClient),
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
