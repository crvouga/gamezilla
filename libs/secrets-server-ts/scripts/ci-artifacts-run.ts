// @io-wall-ok — loads the CI artifacts bucket's credentials, then the ci-artifacts CLI.
/**
 * `ci-artifacts.ts` for a CI job that injects no secrets in setup (Health's
 * `health:objectives`, which reads each environment's secrets itself): the
 * bucket's `CI_ARTIFACTS_*` are read from the secret store for `SECRETS_ENV`
 * (every environment imports the shared one that holds them), passed to the
 * child only, and never printed.
 *
 *   SECRETS_ENV=dev bun run libs/secrets-server-ts/scripts/ci-artifacts-run.ts upload <name> <path>...
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { exportSecretsMap } from '@libs/secrets-server-ts/secrets-io';
import { fillUnsetEnv } from '@libs/secrets-shared-ts/obs-query-env';

const CI_ARTIFACTS_KEYS = [
  'CI_ARTIFACTS_BUCKET',
  'CI_ARTIFACTS_ENDPOINT',
  'CI_ARTIFACTS_REGION',
  'CI_ARTIFACTS_ACCESS_KEY_ID',
  'CI_ARTIFACTS_SECRET_ACCESS_KEY',
] as const;

const env: Record<string, string | undefined> = { ...process.env };
fillUnsetEnv(
  env,
  await exportSecretsMap(process.env['SECRETS_ENV']?.trim() || 'dev'),
  CI_ARTIFACTS_KEYS
);
const run = spawnSync(
  process.execPath,
  [
    join(import.meta.dirname, '../../tools-harness-ts/scripts/ci-artifacts.ts'),
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', env }
);
process.exit(run.status ?? 1);
