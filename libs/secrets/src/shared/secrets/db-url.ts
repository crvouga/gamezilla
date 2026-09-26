import { isProductionEnv } from '@libs/infra/public/env-file';
import { PRODUCTION_ENV_NAMES } from '@libs/infra/public/envs';
import { assertNonProdDatabaseUrl } from '@pkgs/database-url-policy';
import { pingPostgres } from '@pkgs/sql-client-postgres/connect';
import { cliTimers } from '../cli-io';
import { Secret, type SecretInput } from './secret';
import { fetchSecretFrom } from './secrets-io';

const POSTGRES_URL_PREFIX = /^(postgres|postgresql):\/\//i;

/**
 * Every production environment's `DATABASE_URL` that can be read. One that
 * cannot (no access, offline) is skipped; the hostname checks still apply.
 */
async function productionDatabaseUrls(): Promise<readonly string[]> {
  const results = await Promise.allSettled(
    PRODUCTION_ENV_NAMES.map((env) => fetchSecretFrom(env, 'DATABASE_URL'))
  );
  return results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value.trim()] : []
  );
}

async function validateDatabaseUrl(input: SecretInput): Promise<void> {
  const v = input.secretValue.trim();
  if (v.length === 0) throw new Error('Must be non-empty');
  if (!POSTGRES_URL_PREFIX.test(v) && !v.startsWith('http://')) {
    throw new Error('Must start with postgres://, postgresql://, or http://');
  }
  try {
    new URL(v);
  } catch {
    throw new Error('Must be a valid URL');
  }

  if (!isProductionEnv(input.env) && POSTGRES_URL_PREFIX.test(v)) {
    await assertNonProdDatabaseUrl(
      v,
      { surface: 'secret.validate', secretsEnv: input.env.env },
      { productionUrls: await productionDatabaseUrls() }
    );
  }

  if (POSTGRES_URL_PREFIX.test(v)) {
    try {
      await pingPostgres(v, cliTimers);
    } catch (e) {
      throw new Error(
        `Postgres unreachable: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

export const DATABASE_URL = new Secret({
  name: 'DATABASE_URL',
  hint: "Postgres connection URL — derived by OpenTofu from the env's Neon branch endpoint (libs/infra/tofu/modules/database).",
  pushToApiWorker: true,
  managedBy: 'tofu',
  validate: validateDatabaseUrl,
});
