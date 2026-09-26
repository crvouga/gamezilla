import { ENV_FILES, PRODUCTION_ENV_NAMES } from '@libs/infra/public/envs';
import type { SecretsEnvs } from '@pkgs/secret-provider/local-secrets-cache';

/**
 * Every secrets environment this repo has — one per
 * `libs/infra/tofu/envs/<env>.tfvars.json` — and which of them are
 * production (the env file's `protection`, never its name).
 */
export const REPO_SECRETS_ENVS: SecretsEnvs = {
  all: Object.keys(ENV_FILES),
  production: PRODUCTION_ENV_NAMES,
};
