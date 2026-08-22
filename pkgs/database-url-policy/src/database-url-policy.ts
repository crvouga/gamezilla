import { assert } from '@pkgs/assert';

export const PRODUCTION_SECRETS_ENV = 'prd' as const;
export const DEVELOPMENT_SECRETS_ENV = 'dev' as const;

export type DatabaseUrlPolicyOptions = {
  readonly productionHostnames?: readonly string[];
};

/** Opt-in escape hatch for rare check / incident tooling (must be explicit `1`). */
export function productionDatabaseUrlTigerExceptionEnabled(): boolean {
  return process.env['ALLOW_PRODUCTION_DATABASE_URL'] === '1';
}

/**
 * Tiger invariant: non-deploy scripts must run under secrets env `dev`, never `prd`.
 */
export function assertDevSecretsEnv(config: string): void {
  if (config === DEVELOPMENT_SECRETS_ENV) return;
  assert.fail(
    'Tiger invariant: local / development database access requires secrets env `dev`. ' +
      `Got ${config.length > 0 ? JSON.stringify(config) : 'empty'}. ` +
      'Set SECRETS_ENV=dev or run secrets-run. ' +
      'Production deploy uses SECRETS_ENV=prd.',
    { secretsEnv: config }
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

function assertValidDevPostgresWireUrl(
  url: string,
  context: Record<string, unknown>
): void {
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
}

function parsePostgresHostname(
  url: string,
  context: Record<string, unknown>
): string {
  let hostname = '';
  assert.notThrows(
    () => {
      hostname = new URL(url).hostname;
    },
    'DATABASE_URL must parse as a URL',
    context
  );
  return hostname;
}

function assertHostnameNotProductionOnly(
  hostname: string,
  productionHostnames: readonly string[],
  context: Record<string, unknown>
): void {
  for (const denied of productionHostnames) {
    if (hostname === denied) {
      assert.fail(
        'Tiger invariant: DATABASE_URL hostname is listed as production-only',
        { ...context, hostname, deniedHostname: denied }
      );
    }
  }
}

function assertDiffersFromProductionUrl(
  url: string,
  prodUrl: string | null,
  context: Record<string, unknown>
): void {
  if (prodUrl === null || !isPostgresWireUrl(prodUrl)) return;
  const normalized = normalizeDatabaseUrlForCompare(url);
  const normalizedProd = normalizeDatabaseUrlForCompare(prodUrl);
  if (normalized === normalizedProd) {
    assert.fail(
      'Tiger invariant: DATABASE_URL matches production `DATABASE_URL`. ' +
        'Non-deploy contexts must use secrets env `dev` only. ' +
        'If intentional, set ALLOW_PRODUCTION_DATABASE_URL=1.',
      context
    );
  }
}

/**
 * Tiger invariant: block production-looking `DATABASE_URL` in dev / test contexts.
 */
export async function assertNonProdDatabaseUrl(
  url: string,
  context: Record<string, unknown> = {},
  options?: {
    readonly productionUrl?: string | null;
    readonly productionHostnames?: readonly string[];
  }
): Promise<void> {
  if (productionDatabaseUrlTigerExceptionEnabled()) return;

  const productionHostnames = options?.productionHostnames ?? [];
  assertValidDevPostgresWireUrl(url, context);
  assertHostnameNotProductionOnly(
    parsePostgresHostname(url, context),
    productionHostnames,
    context
  );

  const prodUrl =
    options?.productionUrl !== undefined ? options.productionUrl : null;
  assertDiffersFromProductionUrl(url, prodUrl, context);
}

/**
 * Validates `DATABASE_URL` against the active secrets env scope.
 * `prd` is allowed (deploy); everything else runs {@link assertNonProdDatabaseUrl}.
 */
export async function assertDatabaseUrlAllowedForSecretsEnv(
  url: string,
  secretsEnv: string,
  context: Record<string, unknown> = {},
  options?: DatabaseUrlPolicyOptions
): Promise<void> {
  if (secretsEnv === PRODUCTION_SECRETS_ENV) return;
  await assertNonProdDatabaseUrl(url, { ...context, secretsEnv }, options);
}
