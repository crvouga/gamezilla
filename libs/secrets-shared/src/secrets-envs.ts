import { ENV_FILES, PRODUCTION_ENV_NAMES } from '@libs/infra-shared/envs';
import type { SecretsEnvs } from '@pkgs/secret-provider-shared/local-secrets-cache';
import { SHARED_SECRETS_ENV } from './shared-secrets';

/**
 * Every secrets environment this repo has — one per
 * `libs/infra-shared/tofu/envs/<env>.tfvars.json`, plus the shared one the global
 * stacks run with — and which of them never serve from the local cache
 * (production envs by `protection`, and the shared env, which holds every
 * account-wide credential).
 */
export const REPO_SECRETS_ENVS: SecretsEnvs = {
  all: [...Object.keys(ENV_FILES), SHARED_SECRETS_ENV],
  production: [...PRODUCTION_ENV_NAMES, SHARED_SECRETS_ENV],
};
