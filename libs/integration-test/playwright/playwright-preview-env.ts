import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres/connect';

import { previewStackEnv } from '../src/preview-stack-env';

import { applyClerkPlaywrightEnv } from './playwright-clerk-env';

/**
 * Applies secret-store-backed preview env when `DATABASE_URL` is already injected
 * (e.g. `bun run qa:browser` under `secrets-run`). Returns `false` when the
 * config is loaded without secrets — Playwright's IDE test server only needs
 * to list files and must not assert-crash on missing secrets env.
 */
export function applyPlaywrightPreviewEnv(args: {
  readonly baseURL: string;
  readonly localApiPreviewOrigin: string;
}): boolean {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  if (databaseUrl.length === 0) return false;

  process.env['API_URL'] = args.localApiPreviewOrigin;
  process.env['EXPO_PUBLIC_API_URL'] = args.localApiPreviewOrigin;
  process.env['EXPO_PUBLIC_E2E'] = '1';

  const previewEnv = previewStackEnv();
  process.env['DATABASE_URL'] = previewEnv['DATABASE_URL']!;
  process.env['POSTGRES_SCHEMA'] = previewEnv['POSTGRES_SCHEMA']!;
  process.env['SECRETS_ENV'] = previewEnv['SECRETS_ENV']!;

  assertDevSecretsEnv(process.env['SECRETS_ENV'] ?? '');
  assert.ok(
    !isLoopbackPostgresUrl(process.env['DATABASE_URL'] ?? ''),
    'DATABASE_URL must be secrets env `dev` hosted Postgres, not loopback',
    { databaseUrlHost: new URL(process.env['DATABASE_URL']!).hostname }
  );

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
    'DATABASE_URL must be set from secrets env `dev` for preview migrations'
  );
  applyClerkPlaywrightEnv();
  return true;
}

/** Called from globalSetup before tests — never during IDE config probe / `--list`. */
export function assertPlaywrightPreviewEnvReady(): void {
  assert.nonEmptyString(
    process.env['DATABASE_URL'],
    'Playwright browser tests require secrets env `dev` — run `bun run qa:browser` from the repo root (wraps `secrets-run`)'
  );
  assert.nonEmptyString(
    process.env['EXPO_PUBLIC_API_URL'],
    'EXPO_PUBLIC_API_URL must be set for browser E2E against a running stack'
  );
}
