import { isProductionEnv } from '@libs/infra-shared/env-file';
import { PRODUCTION_ENV_NAMES } from '@libs/infra-shared/envs';
import { cliTimers } from '@libs/secrets-shared/cli-io';
import type { SecretInput } from '@libs/secrets-shared/secret';
import { Secret } from '@libs/secrets-shared/secret';
import { assertNonProdDatabaseUrl } from '@pkgs/database-url-policy-shared/database-url-policy';
import { pingPostgres } from '@pkgs/sql-client-postgres-server/ping';
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

/** Shape and non-production policy only. Agents must not ping this URL to validate it. */
export async function validateReadonlyDatabaseUrl(
  input: SecretInput
): Promise<void> {
  const value = input.secretValue.trim();
  if (value.length === 0) throw new Error('Must be non-empty');
  if (!POSTGRES_URL_PREFIX.test(value)) {
    throw new Error('Must start with postgres:// or postgresql://');
  }
  try {
    new URL(value);
  } catch {
    throw new Error('Must be a valid URL');
  }
  if (!isProductionEnv(input.env)) {
    await assertNonProdDatabaseUrl(
      value,
      { surface: 'secret.validate', secretsEnv: input.env.env },
      { productionUrls: await productionDatabaseUrls() }
    );
  }
}

export const DATABASE_URL = new Secret({
  name: 'DATABASE_URL',
  hint: "Postgres connection URL — derived by OpenTofu from this environment's PlanetScale Postgres migrate role (libs/infra-shared/tofu/modules/database).",
  pushToApiWorker: true,
  managedBy: 'tofu',
  validate: validateDatabaseUrl,
});
