/**
 * Single Stripe sync entry point — catalog + patch-db backfills + webhook endpoints.
 *
 * Reads via secret store (`SECRETS_TOKEN` or secrets CLI login):
 *   - `STRIPE_SECRET_KEY` (required)
 *   - `DATABASE_URL`            (required; `postgres://…` or `http://…` for local PGlite)
 *
 * Production API origin is derived from project config (not secret store `API_URL`).
 *
 * Writes via secret store CLI on webhook rebuild:
 *   - `STRIPE_WEBHOOK_SECRET`
 *
 * Flags:
 *   --dry-run   Webhook step logs plan without mutating Stripe / secret store.
 *               (Catalog + patch-db steps are idempotent and always run.)
 *
 * All real work lives in `../src/sync/*` so other entry points (CI gate, future
 * Worker cron, tests) can compose the same orchestration without spawning bun.
 */
import { APP_IDENTITY } from '@libs/auth/shared/app-identity';
import {
  assertDbUrl,
  assertStripeSecretKey,
  createSqlClientFromDbUrl,
  createStripeClientFromSecret,
} from '../src/script-runtime';
import { createStripeScriptSecretStore } from '../src/script-secret-store';
import { createStripeScriptPatchDb } from '../src/stripe-script-patch-db';
import { runStripeFullSync } from '../src/sync';

const SCRIPT_TAG = 'stripe sync';

function resolveProductionApiUrlBase(): string {
  return `https://${APP_IDENTITY.apiHost}`.replace(/\/+$/, '');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const [secret, dbUrl, apiUrlBase] = await Promise.all([
    assertStripeSecretKey(SCRIPT_TAG),
    assertDbUrl(SCRIPT_TAG),
    Promise.resolve(resolveProductionApiUrlBase()),
  ]);

  const stripe = createStripeClientFromSecret(secret);
  const sql = createSqlClientFromDbUrl(dbUrl);
  await sql.connect();
  try {
    const patchDb = createStripeScriptPatchDb(sql);
    const secretStore = createStripeScriptSecretStore();

    const result = await runStripeFullSync({
      stripe,
      patchDb,
      secretStore,
      apiUrlBase,
      dryRun,
    });

    console.log(
      `[${SCRIPT_TAG}] done`,
      JSON.stringify({
        catalog: {
          products: result.catalog.products.length,
          prices: result.catalog.prices.length,
          dumpedToPatchDb: result.catalog.catalogDumped,
        },
        entities: {
          totalWritten: result.entities.totalWritten,
          perEntity: result.entities.perEntity,
        },
        webhooks: result.webhooks,
      })
    );
  } finally {
    await sql.disconnect();
  }
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
