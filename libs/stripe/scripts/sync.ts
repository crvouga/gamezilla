/**
 * Single Stripe sync entry point — catalog + patch-db backfills + webhook endpoints.
 *
 * Reads via Doppler (`DOPPLER_TOKEN` or `doppler login`):
 *   - `STRIPE_SECRET_KEY` (required)
 *   - `DB_URL`            (required; `postgres://…` or `http://…` for local PGlite)
 *   - `API_URL`           (required; absolute origin of the API Worker, no path)
 *
 * Writes via Doppler CLI on webhook rebuild:
 *   - `STRIPE_WEBHOOK_SECRET`
 *
 * Flags:
 *   --dry-run   Webhook step logs plan without mutating Stripe / Doppler.
 *               (Catalog + patch-db steps are idempotent and always run.)
 *
 * All real work lives in `../src/sync/*` so other entry points (CI gate, future
 * Worker cron, tests) can compose the same orchestration without spawning bun.
 */
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

async function assertApiUrlBase(): Promise<string> {
  const store = createStripeScriptSecretStore();
  const raw = (await store.getOptional('API_URL'))?.readSecretValue();
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed.length === 0) {
    console.error(
      `[${SCRIPT_TAG}] API_URL is required in Doppler — absolute origin of the API Worker (no path), e.g. https://api.gamezilla.app`
    );
    process.exit(1);
  }
  return trimmed.replace(/\/+$/, '');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const [secret, dbUrl, apiUrlBase] = await Promise.all([
    assertStripeSecretKey(SCRIPT_TAG),
    assertDbUrl(SCRIPT_TAG),
    assertApiUrlBase(),
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
