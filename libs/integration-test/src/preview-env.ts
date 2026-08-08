import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';

import { previewStackEnv } from './preview-stack-env';

/**
 * Applies preview env for browser E2E (local `@apps/postgres` + wrangler).
 * Returns `false` when SECRETS_ENV is missing so callers can soft-skip during IDE probes.
 */
export function applyBrowserPreviewEnv(args: {
  readonly baseURL: string;
  readonly localApiPreviewOrigin: string;
}): boolean {
  const secretsEnv = process.env['SECRETS_ENV']?.trim() ?? '';
  if (secretsEnv.length === 0) return false;

  process.env['API_URL'] = args.localApiPreviewOrigin;
  process.env['EXPO_PUBLIC_API_URL'] = args.localApiPreviewOrigin;
  process.env['EXPO_PUBLIC_E2E'] = '1';

  const previewEnv = previewStackEnv();
  process.env['DATABASE_URL'] = previewEnv['DATABASE_URL']!;
  process.env['POSTGRES_SCHEMA'] = previewEnv['POSTGRES_SCHEMA']!;
  process.env['SECRETS_ENV'] = previewEnv['SECRETS_ENV']!;

  assertDevSecretsEnv(process.env['SECRETS_ENV'] ?? '');

  assert.equals(
    process.env['API_URL'],
    args.localApiPreviewOrigin,
    'API_URL must point at wrangler dev for preview'
  );
  assert.equals(
    process.env['EXPO_PUBLIC_API_URL'],
    args.localApiPreviewOrigin,
    'EXPO_PUBLIC_API_URL must point at wrangler dev for the client export'
  );
  assert.ok(
    process.env['EXPO_PUBLIC_API_URL'] !== args.baseURL,
    'static preview origin and API origin must differ (Bearer auth is cross-origin)',
    {
      apiUrl: process.env['EXPO_PUBLIC_API_URL'],
      baseURL: args.baseURL,
    }
  );
  assert.nonEmptyString(
    process.env['DATABASE_URL'],
    'DATABASE_URL must be set for preview migrations (@apps/postgres)'
  );
  return true;
}

/** Hard-fail before tests — never during soft env probes. */
export function assertBrowserPreviewEnvReady(): void {
  assert.nonEmptyString(
    process.env['DATABASE_URL'],
    'Browser E2E requires secrets env `dev` — run `bun run check:browser` from the repo root (wraps `secrets-run`)'
  );
  assert.nonEmptyString(
    process.env['EXPO_PUBLIC_API_URL'],
    'EXPO_PUBLIC_API_URL must be set for browser E2E against a running stack'
  );
}
