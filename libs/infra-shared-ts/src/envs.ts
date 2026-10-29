/**
 * Every environment this repo can deploy, parsed and validated at import.
 * A new replica is a new `tofu/envs/<env>.tfvars.json` listed here
 * (`tests/env-files.test.ts` fails if the directory and this list disagree).
 */
import dev from '../tofu/envs/dev.tfvars.json';
import prd from '../tofu/envs/prd.tfvars.json';
import type { EnvFile } from './env-file';
import { parseEnvFile, productionEnvNames } from './env-file';

/** Each env file as committed: placeholders unresolved. */
export const ENV_SOURCES: Readonly<Record<string, unknown>> = { dev, prd };

export const ENV_FILES: Readonly<Record<string, EnvFile>> = Object.fromEntries(
  Object.entries(ENV_SOURCES).map(([name, source]) => [
    name,
    parseEnvFile(source, `tofu/envs/${name}.tfvars.json`),
  ])
);

export function envFile(name: string): EnvFile {
  const file = ENV_FILES[name];
  if (file === undefined) {
    throw new Error(
      `No environment "${name}" (known: ${Object.keys(ENV_FILES).join(', ')})`
    );
  }
  return file;
}

/** Names of every production environment (`protection: "production"`). */
export const PRODUCTION_ENV_NAMES: readonly string[] = productionEnvNames(
  Object.values(ENV_FILES)
);
