import { assertDevVaultConfig } from '@libs/infra/shared/database-url-policy';
import { assert } from '@pkgs/assert';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres-connect';

import { previewStackEnv } from '../constants/preview-stack-env';
import {
  QA_DEV_IDP_PORT,
  QA_PREVIEW_PORT,
} from '../constants/qa-preview-ports';

/**
 * Applies Vault-backed preview env when `DATABASE_URL` is already injected
 * (e.g. `bun run qa:browser` under `vault run`). Returns `false` when the
 * config is loaded without secrets — Playwright's IDE test server only needs
 * to list files and must not assert-crash on missing Vault env.
 */
export function applyPlaywrightPreviewEnv(args: {
  readonly baseURL: string;
  readonly localApiPreviewOrigin: string;
}): boolean {
  const databaseUrl = process.env['DATABASE_URL']?.trim() ?? '';
  if (databaseUrl.length === 0) return false;

  process.env['LOCAL_PREVIEW_API_PROXY_TARGET'] = args.localApiPreviewOrigin;
  process.env['BETTER_AUTH_PREVIEW_API_URL'] = args.baseURL;
  process.env['API_URL'] = args.baseURL;
  process.env['EXPO_PUBLIC_API_URL'] = args.baseURL;
  process.env['EXPO_PUBLIC_E2E'] = '1';
  process.env['PREVIEW_PORT'] = String(QA_PREVIEW_PORT);
  process.env['DEV_IDP_PORT'] = String(QA_DEV_IDP_PORT);

  const previewEnv = previewStackEnv();
  process.env['DATABASE_URL'] = previewEnv['DATABASE_URL']!;
  process.env['POSTGRES_SCHEMA'] = previewEnv['POSTGRES_SCHEMA']!;
  process.env['VAULT_CONFIG'] = previewEnv['VAULT_CONFIG']!;

  assertDevVaultConfig(process.env['VAULT_CONFIG'] ?? '');
  assert.ok(
    !isLoopbackPostgresUrl(process.env['DATABASE_URL'] ?? ''),
    'DATABASE_URL must be Vault dev hosted Postgres, not loopback',
    { databaseUrlHost: new URL(process.env['DATABASE_URL']!).hostname }
  );

  assert.equals(
    process.env['BETTER_AUTH_PREVIEW_API_URL'],
    args.baseURL,
    'BETTER_AUTH_PREVIEW_API_URL must match the web preview origin for same-origin OAuth'
  );
  assert.equals(
    process.env['LOCAL_PREVIEW_API_PROXY_TARGET'],
    args.localApiPreviewOrigin,
    'LOCAL_PREVIEW_API_PROXY_TARGET must point at the wrangler preview worker'
  );
  assert.equals(
    process.env['API_URL'],
    args.baseURL,
    'API_URL must be the web preview origin (same-origin auth cookies)'
  );
  assert.equals(
    process.env['EXPO_PUBLIC_API_URL'],
    args.baseURL,
    'EXPO_PUBLIC_API_URL must match API_URL for the client export'
  );
  assert.nonEmptyString(
    process.env['DATABASE_URL'],
    'DATABASE_URL must be set from Vault dev for preview migrations'
  );
  return true;
}

/** Called from globalSetup before tests — never during IDE config probe / `--list`. */
export function assertPlaywrightPreviewEnvReady(): void {
  assert.nonEmptyString(
    process.env['DATABASE_URL'],
    'Playwright browser tests require Vault dev secrets — run `bun run qa:browser` from the repo root (wraps `vault run`)'
  );
  assert.nonEmptyString(
    process.env['LOCAL_PREVIEW_API_PROXY_TARGET'],
    'LOCAL_PREVIEW_API_PROXY_TARGET must be set for the preview webServer'
  );
}
