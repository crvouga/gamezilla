/**
 * Shared runtime for Stripe CLI sync scripts.
 *
 * Centralizes secret resolution (Stripe key, `DATABASE_URL`), Stripe client
 * construction, and SqlClient setup so per-entity scripts stay thin and
 * consistent (Tiger Style: small surface, fail fast).
 *
 * `DATABASE_URL` must be `postgres://` or `postgresql://` (TCP Postgres).
 */
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgPool } from '@pkgs/sql-client/postgres-connect';
import {
  assertDevSecretsEnv,
  PRODUCTION_SECRETS_ENV,
} from '@libs/infra/shared/database-url-policy';
import { assertDatabaseUrlAllowedForSecretsEnvForTooling } from '@libs/infra/shared/database-url-policy-tooling';
import { resolveSecretsScope } from '@pkgs/secrets-config/infisical-json';
import { appPostgresDbScope } from '@libs/infra/namespace-bindings';
import { join } from 'node:path';
import Stripe from 'stripe';
import { createStripeScriptSecretStore } from './script-secret-store';
import { StripeSecretKeys } from './secret-keys';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function isPostgresDbUrl(u: string): boolean {
  return u.startsWith('postgres://') || u.startsWith('postgresql://');
}

/**
 * Read `STRIPE_SECRET_KEY` from the secret store. Exits process on missing/blank — these
 * scripts have no useful behavior without it.
 */
export async function assertStripeSecretKey(
  scriptTag: string
): Promise<string> {
  const store = await createStripeScriptSecretStore();
  const raw = (
    await store.getOptional(StripeSecretKeys.secretKey)
  )?.readSecretValue();
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) {
    console.error(
      `[${scriptTag}] STRIPE_SECRET_KEY is missing or blank — run under \`bun run scripts/secrets-run.ts\``
    );
    process.exit(1);
  }
  return trimmed;
}

function resolveSecretsEnvName(): string {
  const fromEnv = process.env['SECRETS_ENV']?.trim() ?? '';
  if (fromEnv.length > 0) return fromEnv;
  return resolveSecretsScope(REPO_ROOT).env;
}

/**
 * Read `DATABASE_URL` from the secret store. Exits when missing or unsupported — backfill
 * scripts only do persistence, so absent DB makes them a no-op (footgun).
 */
export async function assertDbUrl(scriptTag: string): Promise<string> {
  const secretsEnv = resolveSecretsEnvName();
  if (secretsEnv !== PRODUCTION_SECRETS_ENV) {
    assertDevSecretsEnv(secretsEnv);
  }
  const store = await createStripeScriptSecretStore();
  const raw =
    (await store.getOptional('DATABASE_URL'))?.readSecretValue() ?? '';
  const u = raw.trim();
  if (u.length === 0) {
    console.error(
      `[${scriptTag}] DATABASE_URL is missing — set a postgres://… connection string`
    );
    process.exit(1);
  }
  if (!isPostgresDbUrl(u)) {
    console.error(
      `[${scriptTag}] DATABASE_URL must be a postgres:// or postgresql:// URL`
    );
    process.exit(1);
  }
  await assertDatabaseUrlAllowedForSecretsEnvForTooling(u, secretsEnv, {
    surface: scriptTag,
  });
  return u;
}

/**
 * Optional `DATABASE_URL` resolver — preserves soft-skip semantics for callers that
 * want catalog reconcile without entity_store persistence (e.g. CI gate scripts
 * running where no Postgres is reachable).
 */
export async function resolveOptionalDbUrl(): Promise<string | undefined> {
  const store = await createStripeScriptSecretStore();
  const raw =
    (await store.getOptional('DATABASE_URL'))?.readSecretValue() ?? '';
  const u = raw.trim();
  if (u.length === 0) return undefined;
  if (isPostgresDbUrl(u)) return u;
  return undefined;
}

/** Build a {@link SqlClient} for the given `DATABASE_URL` (TCP Postgres). */
export function createSqlClientFromDbUrl(dbUrl: string): SqlClient {
  return createPgPool({
    connectionString: dbUrl,
    dbScope: appPostgresDbScope(),
    max: 1,
  }).sqlClient;
}

export function createStripeClientFromSecret(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export type StripeScriptContext = {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
  readonly disconnect: () => Promise<void>;
};

/**
 * Build a fully-wired script context: Stripe client + SqlClient backed by
 * Postgres. Caller MUST `await ctx.disconnect()` in a `finally` block.
 */
export async function createStripeScriptContext(
  scriptTag: string
): Promise<StripeScriptContext> {
  const [secret, dbUrl] = await Promise.all([
    assertStripeSecretKey(scriptTag),
    assertDbUrl(scriptTag),
  ]);
  const stripe = createStripeClientFromSecret(secret);
  const sql = createSqlClientFromDbUrl(dbUrl);
  await sql.connect();
  return {
    stripe,
    sql,
    disconnect: () => sql.disconnect(),
  };
}
