/**
 * Shared runtime for Stripe CLI sync scripts.
 *
 * Centralizes secret resolution (Stripe key, `DB_URL`), Stripe client
 * construction, and PatchDb setup so per-entity scripts stay thin and
 * consistent (Tiger Style: small surface, fail fast).
 *
 * `DB_URL` accepts either:
 *   - `postgres://` / `postgresql://` — direct Postgres over Bun's TCP driver
 *     (production, deploys, any reachable Postgres).
 *   - `http://` / `https://` — local PGlite HTTP dev server (`apps/db`),
 *     selected automatically when running against Doppler `local`.
 *
 * Mirrors the URL-prefix dispatch already used by `apps/db/scripts/migrate-db.ts`
 * and `apps/api/src/db/sql-client.ts` so the dev/prod boundary stays uniform.
 */
import { SqlClientImplPgliteHttp } from '@gamezilla/lib/sql-client/impl-pglite-http';
import { SqlClientImplPostgresTcp } from '@gamezilla/lib/sql-client/impl-postgres-tcp';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { PatchDbImplPostgres } from '@gamezilla/patch-db/impl-postgres/impl-postgres';
import Stripe from 'stripe';
import { createStripeScriptSecretStore } from './script-secret-store';
import { StripeSecretKeys } from './secret-keys';
import { createStripeScriptPatchDb } from './stripe-script-patch-db';

function isPostgresDbUrl(u: string): boolean {
  return u.startsWith('postgres://') || u.startsWith('postgresql://');
}

function isHttpDbUrl(u: string): boolean {
  return u.startsWith('http://') || u.startsWith('https://');
}

function isSupportedDbUrl(u: string): boolean {
  return isPostgresDbUrl(u) || isHttpDbUrl(u);
}

/**
 * Read `STRIPE_SECRET_KEY` from Doppler. Exits process on missing/blank — these
 * scripts have no useful behavior without it.
 */
export async function assertStripeSecretKey(
  scriptTag: string
): Promise<string> {
  const store = createStripeScriptSecretStore();
  const raw = await store.getOptional(StripeSecretKeys.secretKey);
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) {
    console.error(
      `[${scriptTag}] STRIPE_SECRET_KEY is missing or blank in Doppler (set DOPPLER_TOKEN or run \`doppler login\`)`
    );
    process.exit(1);
  }
  return trimmed;
}

/**
 * Read `DB_URL` from Doppler. Exits when missing or unsupported — backfill
 * scripts only do persistence, so absent DB makes them a no-op (footgun).
 */
export async function assertDbUrl(scriptTag: string): Promise<string> {
  const store = createStripeScriptSecretStore();
  const raw = (await store.getOptional('DB_URL')) ?? '';
  const u = raw.trim();
  if (u.length === 0) {
    console.error(
      `[${scriptTag}] DB_URL is missing in Doppler — set a postgres://… connection string, or http://127.0.0.1:15432 for the local PGlite dev server`
    );
    process.exit(1);
  }
  if (!isSupportedDbUrl(u)) {
    console.error(
      `[${scriptTag}] DB_URL must be a postgres://, postgresql://, or http(s):// URL`
    );
    process.exit(1);
  }
  return u;
}

/**
 * Optional `DB_URL` resolver — preserves soft-skip semantics for callers that
 * want catalog reconcile without patch-db persistence (e.g. CI gate scripts
 * running where no Postgres / PGlite is reachable).
 */
export async function resolveOptionalDbUrl(): Promise<string | undefined> {
  const store = createStripeScriptSecretStore();
  const raw = (await store.getOptional('DB_URL')) ?? '';
  const u = raw.trim();
  if (u.length === 0) return undefined;
  if (isSupportedDbUrl(u)) return u;
  return undefined;
}

/**
 * Build a {@link SqlClient} for the given `DB_URL`. HTTP URLs route to the
 * PGlite HTTP dev server; postgres URLs route to Bun's TCP driver.
 */
export function createSqlClientFromDbUrl(dbUrl: string): SqlClient {
  if (isHttpDbUrl(dbUrl)) {
    return new SqlClientImplPgliteHttp(dbUrl);
  }
  return SqlClientImplPostgresTcp.connect(dbUrl);
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
 * whichever SQL impl matches `DB_URL` (Postgres TCP or PGlite HTTP).
 * Caller MUST `await ctx.disconnect()` in a `finally` block.
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
