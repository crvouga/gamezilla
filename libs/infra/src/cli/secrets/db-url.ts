import { pingPostgres } from '@pkgs/sql-client/postgres/connect';
import {
  assertNonProdDatabaseUrl,
  DEVELOPMENT_SECRETS_ENV,
} from '../../shared/database-url-policy';
import { Secret, type SecretInput } from './secret';
import { fetchSecretFrom } from './secrets-io';

const POSTGRES_URL_PREFIX = /^(postgres|postgresql):\/\//i;

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

  if (input.env === DEVELOPMENT_SECRETS_ENV && POSTGRES_URL_PREFIX.test(v)) {
    let productionUrl: string | null = null;
    try {
      productionUrl = (await fetchSecretFrom('prd', 'DATABASE_URL')).trim();
    } catch {
      productionUrl = null;
    }
    await assertNonProdDatabaseUrl(
      v,
      { surface: 'secret.validate', secretsEnv: input.env },
      { productionUrl }
    );
  }

  if (POSTGRES_URL_PREFIX.test(v)) {
    try {
      await pingPostgres(v);
    } catch (e) {
      throw new Error(
        `Postgres unreachable: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

export const DATABASE_URL = new Secret({
  name: 'DATABASE_URL',
  hint: 'Postgres connection URL (postgresql://…)',
  pushToApiWorker: true,
  validate: validateDatabaseUrl,
});
