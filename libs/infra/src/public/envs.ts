/**
 * Every environment this repo can deploy, parsed and validated at import.
 * A new replica is a new `tofu/envs/<env>.tfvars.json` listed here
 * (`tests/env-files.test.ts` fails if the directory and this list disagree).
 */
import dev from '../../tofu/envs/dev.tfvars.json';
import prd from '../../tofu/envs/prd.tfvars.json';
import { type EnvFile, parseEnvFile } from './env-file';

export const ENV_FILES: Readonly<Record<string, EnvFile>> = {
  dev: parseEnvFile(dev, 'tofu/envs/dev.tfvars.json'),
  prd: parseEnvFile(prd, 'tofu/envs/prd.tfvars.json'),
};

export function envFile(name: string): EnvFile {
  const file = ENV_FILES[name];
  if (file === undefined) {
    throw new Error(
      `No environment "${name}" (known: ${Object.keys(ENV_FILES).join(', ')})`
    );
  }
  return file;
}
