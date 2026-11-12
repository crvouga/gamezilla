// @io-wall-ok — loads an environment's query credentials, then the obs CLI.
/**
 * `bun obs`. A production source (`--source prod`, `platform`) reads the
 * first production environment's telemetry, or the one `--env <name>` names
 * (`bun obs errors --since 1d --source prod --env dev`): its read-only query
 * credentials are loaded from the secret store, and `--env` is taken out of
 * the arguments the CLI sees. Credentials already in the environment win
 * unless `--env` names one explicitly; then only its own are used.
 */
import { envFile, PRODUCTION_ENV_NAMES } from '@libs/infra-shared-ts/envs';
import { exportSecretsMap } from '@libs/secrets-server-ts/secrets-io';
import {
  fillUnsetEnv,
  OBS_QUERY_KEYS,
  PLATFORM_QUERY_KEYS,
  productionQueryRequested,
  takeEnvFlag,
} from '@libs/secrets-shared-ts/obs-query-env';

async function loadQueryCredentials(
  argv: readonly string[],
  named: string | undefined
): Promise<void> {
  if (!productionQueryRequested(argv)) return;
  const env = named ?? PRODUCTION_ENV_NAMES[0];
  if (env === undefined) return;
  const keys = argv[0] === 'platform' ? PLATFORM_QUERY_KEYS : OBS_QUERY_KEYS;
  // A named environment never falls back to another one's credentials.
  if (named !== undefined) for (const key of keys) delete process.env[key];
  try {
    const values = await exportSecretsMap(env);
    fillUnsetEnv(process.env, values, keys);
  } catch {
    process.stderr.write(
      `obs: ${env} query credentials were not loaded; continuing with the environment already set\n`
    );
  }
}

const { env: named, argv } = takeEnvFlag(process.argv.slice(2));
if (named !== undefined) {
  try {
    envFile(named);
  } catch (error) {
    process.stderr.write(
      `obs: --env ${named}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(2);
  }
}
process.argv = [...process.argv.slice(0, 2), ...argv];
await loadQueryCredentials(argv, named);
await import('@pkgs/observability-cli-server-ts/cli-io');
