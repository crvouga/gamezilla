import { assert } from '@pkgs/assert';
import { VaultSecretStore } from '@pkgs/secret-store/vault-secret-store';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres-connect';
import { VaultCli } from '@pkgs/vault/vault-cli';

import { PROJECT_CONFIG } from '../project-config';

export const PRODUCTION_VAULT_CONFIG = 'prd' as const;
export const DEVELOPMENT_VAULT_CONFIG = 'dev' as const;

/** Opt-in escape hatch for rare QA / incident tooling (must be explicit `1`). */
export function productionDatabaseUrlTigerExceptionEnabled(): boolean {
  return process.env['ALLOW_PRODUCTION_DATABASE_URL'] === '1';
}

/**
 * Tiger invariant: non-deploy scripts must run under Vault `dev`, never `prd`.
 */
export function assertDevVaultConfig(config: string): void {
  if (config === DEVELOPMENT_VAULT_CONFIG) return;
  assert.fail(
    'Tiger invariant: local / development database access requires Vault config `dev`. ' +
      `Got ${config.length > 0 ? JSON.stringify(config) : 'empty'}. ` +
      'Set VAULT_CONFIG=dev, run `vault setup --project personal --config dev` from the repo root, ' +
      'or use `bun run scripts/vault-run.ts`. Production deploy uses `bun run infra` (VAULT_CONFIG=prd).',
    { vaultConfig: config }
  );
}

/** Strip credentials so two URLs can be compared without leaking secrets. */
export function normalizeDatabaseUrlForCompare(url: string): string {
  const parsed = new URL(url);
  parsed.password = '';
  parsed.username = '';
  return parsed.toString();
}

function isPostgresWireUrl(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

async function fetchProductionDatabaseUrlFromVault(): Promise<string | null> {
  try {
    const cli = new VaultCli();
    const { token } = cli.resolveToken();
    const scope = cli.resolveScope();
    const store = new VaultSecretStore({
      token,
      addr: scope.addr,
      mount: scope.mount,
      project: scope.project,
      config: PRODUCTION_VAULT_CONFIG,
    });
    const raw =
      (await store.getOptional('DATABASE_URL'))?.readSecretValue() ?? '';
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Tiger invariant: block production-looking `DATABASE_URL` in dev / test contexts.
 * Compares against loopback, optional hostname denylist, and Vault `prd` `DATABASE_URL`.
 */
export async function assertNonProdDatabaseUrl(
  url: string,
  context: Record<string, unknown> = {},
  options?: { readonly productionUrl?: string | null }
): Promise<void> {
  if (productionDatabaseUrlTigerExceptionEnabled()) return;

  assert.nonEmptyString(
    url,
    'DATABASE_URL must be a non-empty string',
    context
  );
  if (!isPostgresWireUrl(url)) {
    assert.fail(
      'Tiger invariant: DATABASE_URL must be a postgres:// or postgresql:// wire URL',
      { ...context, url: normalizeDatabaseUrlForCompare(url) }
    );
  }

  if (isLoopbackPostgresUrl(url)) {
    assert.fail(
      'Tiger invariant: non-production DATABASE_URL must not target loopback Postgres. ' +
        'Local embedded Postgres was removed — use Vault `dev` `DATABASE_URL` (hosted dev database). ' +
        'If you intentionally need a loopback or production URL, set ALLOW_PRODUCTION_DATABASE_URL=1.',
      context
    );
  }

  let hostname = '';
  assert.notThrows(
    () => {
      hostname = new URL(url).hostname;
    },
    'DATABASE_URL must parse as a URL',
    context
  );

  for (const denied of PROJECT_CONFIG.postgres.productionHostnames) {
    if (hostname === denied) {
      assert.fail(
        'Tiger invariant: DATABASE_URL hostname is listed as production-only',
        { ...context, hostname, deniedHostname: denied }
      );
    }
  }

  const prodUrl =
    options?.productionUrl !== undefined
      ? options.productionUrl
      : await fetchProductionDatabaseUrlFromVault();

  if (prodUrl !== null && isPostgresWireUrl(prodUrl)) {
    const normalized = normalizeDatabaseUrlForCompare(url);
    const normalizedProd = normalizeDatabaseUrlForCompare(prodUrl);
    if (normalized === normalizedProd) {
      assert.fail(
        'Tiger invariant: DATABASE_URL matches Vault `prd` `DATABASE_URL`. ' +
          'Non-deploy contexts must use Vault `dev` only. ' +
          'If intentional, set ALLOW_PRODUCTION_DATABASE_URL=1.',
        context
      );
    }
  }
}

/**
 * Validates `DATABASE_URL` against the active Vault config scope.
 * `prd` is allowed (deploy); everything else runs {@link assertNonProdDatabaseUrl}.
 */
export async function assertDatabaseUrlAllowedForVaultConfig(
  url: string,
  vaultConfig: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  if (vaultConfig === PRODUCTION_VAULT_CONFIG) return;
  await assertNonProdDatabaseUrl(url, { ...context, vaultConfig });
}
