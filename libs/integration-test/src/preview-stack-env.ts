import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';

import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from './local-api-preview';

/**
 * Keep in sync with apps/postgres/scripts/ports.ts and api setup-dev-vars.
 * Non-prod preview/check stacks use `@apps/postgres` embedded, not Infisical Neon.
 */
const LOCAL_POSTGRES_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:15432/local?sslmode=disable';

/**
 * Env overrides for local/CI check preview stacks. Pins the client export to
 * wrangler on :8788 — secrets-run may inject production `EXPO_PUBLIC_API_URL`,
 * which would bake into `expo export` and leave the SPA calling api.gamezilla.app
 * (auth never binds → infinite boot spinner).
 *
 * `DATABASE_URL` always targets `@apps/postgres` for SECRETS_ENV=dev.
 */
export function previewStackEnv(): Record<string, string> {
  const secretsEnv = process.env['SECRETS_ENV']?.trim() ?? 'dev';
  assertDevSecretsEnv(secretsEnv);
  assert.nonEmptyString(
    LOCAL_POSTGRES_DATABASE_URL,
    'LOCAL_POSTGRES_DATABASE_URL must be set for check preview'
  );
  return {
    DATABASE_URL: LOCAL_POSTGRES_DATABASE_URL,
    POSTGRES_SCHEMA: process.env['POSTGRES_SCHEMA']?.trim() || 'public',
    SECRETS_ENV: secretsEnv,
    API_URL: DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
    EXPO_PUBLIC_API_URL: DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
    EXPO_PUBLIC_E2E: '1',
  };
}
