/**
 * Shared runtime for Stripe CLI sync scripts.
 *
 * Centralizes secret resolution (Stripe key, Postgres `DB_URL`), Stripe client
 * construction, and Postgres-backed `EntityDb` setup so per-entity scripts stay
 * thin and consistent (Tiger Style: small surface, fail fast).
 */
import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import { SqlClientImplPostgresTcp } from '@gamezilla/lib/sql-client/impl-postgres-tcp';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import Stripe from 'stripe';
import { createStripeScriptSecretStore } from './script-secret-store';
import { StripeSecretKeys } from './secret-keys';
import { createStripeWebhookCacheEntityDb } from './webhook-cache-entity-db';

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
 * Read `DB_URL` from Doppler. Exits when missing or non-Postgres URL — backfill
 * scripts only do persistence, so absent DB makes them a no-op (footgun).
 */
export async function assertPostgresUrl(scriptTag: string): Promise<string> {
  const store = createStripeScriptSecretStore();
  const raw = (await store.getOptional('DB_URL')) ?? '';
  const u = raw.trim();
  if (u.length === 0) {
    console.error(
      `[${scriptTag}] DB_URL is missing in Doppler — set a postgres://… connection string for entity-db persistence`
    );
    process.exit(1);
  }
  if (!u.startsWith('postgres://') && !u.startsWith('postgresql://')) {
    console.error(
      `[${scriptTag}] DB_URL must be a postgres:// or postgresql:// connection string`
    );
    process.exit(1);
  }
  return u;
}

/**
 * Optional `DB_URL` resolver — preserves the soft-skip semantics expected by
 * `sync-catalog.ts` (catalog reconcile is useful with or without persistence).
 */
export async function resolveOptionalPostgresUrl(): Promise<
  string | undefined
> {
  const store = createStripeScriptSecretStore();
  const raw = (await store.getOptional('DB_URL')) ?? '';
  const u = raw.trim();
  if (u.length === 0) return undefined;
  if (u.startsWith('postgres://') || u.startsWith('postgresql://')) return u;
  return undefined;
}

export function createStripeClientFromSecret(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export type StripeScriptContext = {
  readonly stripe: Stripe;
  readonly sql: SqlClient;
  readonly entityDb: EntityDb;
  readonly disconnect: () => Promise<void>;
};

/**
 * Build a fully-wired script context: Stripe client + Postgres-backed EntityDb.
 * Caller MUST `await ctx.disconnect()` in a `finally` block.
 */
export async function createStripeScriptContext(
  scriptTag: string
): Promise<StripeScriptContext> {
  const [secret, pgUrl] = await Promise.all([
    assertStripeSecretKey(scriptTag),
    assertPostgresUrl(scriptTag),
  ]);
  const stripe = createStripeClientFromSecret(secret);
  const sql = SqlClientImplPostgresTcp.connect(pgUrl);
  const entityDb = createStripeWebhookCacheEntityDb(sql);
  return {
    stripe,
    sql,
    entityDb,
    disconnect: () => sql.disconnect(),
  };
}
