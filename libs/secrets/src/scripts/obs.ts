// @io-wall-ok — loads production query credentials, then the obs CLI.
import { PRODUCTION_ENV_NAMES } from '@libs/infra/public/envs';
import {
  fillUnsetEnv,
  OBS_QUERY_KEYS,
  productionQueryRequested,
} from '../shared/secrets/obs-query-env';
import { exportSecretsMap } from '../shared/secrets/secrets-io';

async function loadProductionQueryCredentials(
  argv: readonly string[]
): Promise<void> {
  if (!productionQueryRequested(argv)) return;
  const env = PRODUCTION_ENV_NAMES[0];
  if (env === undefined) return;
  try {
    const values = await exportSecretsMap(env);
    fillUnsetEnv(process.env, values, OBS_QUERY_KEYS);
  } catch {
    process.stderr.write(
      'obs: production query credentials were not loaded; continuing with the environment already set\n'
    );
  }
}

await loadProductionQueryCredentials(process.argv.slice(2));
await import('../../../../pkgs/observability-cli/src/cli-io.ts');
