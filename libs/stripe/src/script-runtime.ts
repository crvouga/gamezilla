/**
 * Shared runtime for Stripe CLI sync scripts.
 *
 * Centralizes secret resolution (Stripe key, `DATABASE_URL`), Stripe client
 * construction, and PatchDb setup so per-entity scripts stay thin and
 * consistent (Tiger Style: small surface, fail fast).
 *
 * `DATABASE_URL` must be `postgres://` or `postgresql://` (TCP Postgres).
 */
import type { PatchDbImplPostgres } from '@pkgs/patch-db/impl-postgres/impl-postgres';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgPool } from '@pkgs/sql-client/postgres-connect';
import { gamezillaPostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import Stripe from 'stripe';
import { createStripeScriptSecretStore } from './script-secret-store';
import { StripeSecretKeys } from './secret-keys';
import { createStripeScriptPatchDb } from './stripe-script-patch-db';

function isPostgresDbUrl(u: string): boolean {
  return u.startsWith('postgres://') || u.startsWith('postgresql://');
}

/**
 * Read `STRIPE_SECRET_KEY` from Vault. Exits process on missing/blank — these
 * scripts have no useful behavior without it.
 */
export async function assertStripeSecretKey(
  scriptTag: string
): Promise<string> {
  const store = createStripeScriptSecretStore();
  const raw = (
    await store.getOptional(StripeSecretKeys.secretKey)
  )?.readSecretValue();
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) {
    console.error(
      `[${scriptTag}] STRIPE_SECRET_KEY is missing or blank in Vault (set VAULT_TOKEN or run \`vault login\`)`
    );
    process.exit(1);
  }
  return trimmed;
}

/**
 * Read `DATABASE_URL` from Vault. Exits when missing or unsupported — backfill
 * scripts only do persistence, so absent DB makes them a no-op (footgun).
 */
export async function assertDbUrl(scriptTag: string): Promise<string> {
  const store = createStripeScriptSecretStore();
  const raw =
    (await store.getOptional('DATABASE_URL'))?.readSecretValue() ?? '';
  const u = raw.trim();
  if (u.length === 0) {
    console.error(
      `[${scriptTag}] DATABASE_URL is missing in Vault — set a postgres://… connection string`
    );
    process.exit(1);
  }
  if (!isPostgresDbUrl(u)) {
    console.error(
      `[${scriptTag}] DATABASE_URL must be a postgres:// or postgresql:// URL`
    );
    process.exit(1);
  }
  return u;
}

/**
 * Optional `DATABASE_URL` resolver — preserves soft-skip semantics for callers that
 * want catalog reconcile without patch-db persistence (e.g. CI gate scripts
 * running where no Postgres is reachable).
 */
export async function resolveOptionalDbUrl(): Promise<string | undefined> {
  const store = createStripeScriptSecretStore();
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
    dbScope: gamezillaPostgresDbScope(),
    max: 1,
  }).sqlClient;
}

export function createStripeClientFromSecret(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export type StripeScriptContext = {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
  readonly patchDb: PatchDbImplPostgres;
  readonly disconnect: () => Promise<void>;
};

/**
 * Build a fully-wired script context: Stripe client + PatchDb backed by
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
  const patchDb = createStripeScriptPatchDb(sql);
  return {
    stripe,
    sql,
    patchDb,
    disconnect: () => sql.disconnect(),
  };
}
