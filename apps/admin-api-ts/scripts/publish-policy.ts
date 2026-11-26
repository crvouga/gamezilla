// @io-wall-ok — release uses the environment's database and publisher after foundation.
import { assertNonProdDatabaseUrlForTooling } from '@libs/db-server-ts/database-url-policy-tooling';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { activeEnvFile } from '@libs/infra-server-ts/worker-deploy';
import { isProductionEnv } from '@libs/infra-shared-ts/env-file';
import { PRODUCTION_ENV_NAMES } from '@libs/infra-shared-ts/envs';
import { publishDeploymentPolicy } from '@libs/permissions-server-ts/publish-deployment-policy';
import { HttpPubSubFromSecretStore } from '@libs/pubsub-server-ts/create-http-pubsub-from-secret-store';
import { refreshSecretsIntoEnv } from '@libs/secrets-server-ts/secrets';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createScriptSecretStore } from '@pkgs/secret-store-shared-ts/create-script-secret-store';
import { createPgPool } from '@pkgs/sql-client-postgres-server-ts/connect';

const env = activeEnvFile();
await refreshSecretsIntoEnv();
const secrets = createScriptSecretStore();
const url = (await secrets.getRequired('DATABASE_URL')).readSecretValue();
if (!isProductionEnv(env))
  await assertNonProdDatabaseUrlForTooling(url, PRODUCTION_ENV_NAMES, {
    surface: 'publish-permission-policy',
    secretsEnv: env.env,
  });
const publisher = await new HttpPubSubFromSecretStore(
  secrets,
  wallClock.now,
  createGlobalHttpClient()
).get();
if (publisher === undefined)
  throw new Error('Permission policy requires a publisher');
try {
  const { pool, sqlClient } = createPgPool({
    connectionString: url,
    dbScope: appPostgresDbScope(),
    max: 1,
  });
  try {
    await publishDeploymentPolicy(
      sqlClient,
      wallClock,
      publisher,
      env.worker.admin_account_ids
    );
  } finally {
    await pool.end();
  }
} finally {
  publisher.close();
}
