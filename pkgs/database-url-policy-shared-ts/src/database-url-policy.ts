import { assert } from '@pkgs/assert-root-shared-ts/singleton';

export type DatabaseUrlPolicyOptions = {
  readonly productionHostnames?: readonly string[];
};

/** Opt-in escape hatch for rare check / incident tooling (must be explicit `1`). */
export function productionDatabaseUrlTigerExceptionEnabled(): boolean {
  return process.env['ALLOW_PRODUCTION_DATABASE_URL'] === '1';
}

/**
 * Tiger invariant: non-deploy scripts never run under a production secrets
 * env. Which environments are production is the caller's decision.
 */
export function assertNonProductionSecretsEnv(
  secretsEnv: string,
  productionEnvs: readonly string[]
): void {
  if (secretsEnv.length > 0 && !productionEnvs.includes(secretsEnv)) return;
  assert.fail(
    'Tiger invariant: local / development database access requires a non-production secrets env. ' +
      `Got ${secretsEnv.length > 0 ? JSON.stringify(secretsEnv) : 'empty'} ` +
      `(production: ${productionEnvs.join(', ') || 'none'}). ` +
      'Set SECRETS_ENV to a non-production environment or run secrets-run.',
    { secretsEnv, productionEnvs }
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

function assertDiffersFromProductionUrls(
  url: string,
  prodUrls: readonly string[],
  context: Record<string, unknown>
): void {
  const normalized = normalizeDatabaseUrlForCompare(url);
  for (const prodUrl of prodUrls) {
    if (!isPostgresWireUrl(prodUrl)) continue;
    if (normalized === normalizeDatabaseUrlForCompare(prodUrl)) {
      assert.fail(
        'Tiger invariant: DATABASE_URL matches a production `DATABASE_URL`. ' +
          'Non-deploy contexts must use a non-production secrets env only. ' +
          'If intentional, set ALLOW_PRODUCTION_DATABASE_URL=1.',
        context
      );
    }
  }
}

/**
 * Tiger invariant: block production-looking `DATABASE_URL` in dev / test contexts.
 */
export async function assertNonProdDatabaseUrl(
  url: string,
  context: Record<string, unknown> = {},
  options?: {
    /** Every production environment's `DATABASE_URL` the caller could read. */
    readonly productionUrls?: readonly string[];
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

  assertDiffersFromProductionUrls(url, options?.productionUrls ?? [], context);
}
