/**
 * One-shot repair: end live spaces whose host has no active membership (I1).
 *
 *   bun run scripts/secrets-run.ts -- bun run --filter @libs/spaces repair:departed-host-spaces
 */
import {
  assertDevSecretsEnv,
  DEVELOPMENT_SECRETS_ENV,
} from '@libs/infra/shared/database-url-policy';
import { assertNonProdDatabaseUrlForTooling } from '@libs/infra/shared/database-url-policy-tooling';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { endLiveSpacesWithoutActiveHostSeat } from '../src/shared/repair-live-spaces-without-host-seat';
import { createPgPool } from '@pkgs/sql-client/postgres/connect';

async function main(): Promise<void> {
  const secretsEnv =
    process.env['SECRETS_ENV']?.trim() || DEVELOPMENT_SECRETS_ENV;
  assertDevSecretsEnv(secretsEnv);

  const databaseUrl = (process.env['DATABASE_URL'] ?? '').trim();
  if (databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required (run via secrets-run)');
  }
  await assertNonProdDatabaseUrlForTooling(databaseUrl, {
    surface: 'spaces:repair-departed-host-spaces',
    secretsEnv,
  });

  const { pool, sqlClient } = createPgPool({
    connectionString: databaseUrl,
    dbScope: appPostgresDbScope(),
  });
  try {
    const n = await endLiveSpacesWithoutActiveHostSeat(sqlClient);
    process.stdout.write(
      `[repair-departed-host-spaces] ended ${n} live space(s) without an active host seat\n`
    );
  } finally {
    await pool.end();
  }
}

await main();
