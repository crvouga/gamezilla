/**
 * Single Stripe sync entry point — catalog + entity_store backfills.
 *
 * Reads via secret store (`SECRETS_TOKEN` or secrets CLI login):
 *   - `STRIPE_SECRET_KEY` (required)
 *   - `DATABASE_URL`            (required; `postgres://…`)
 */
import {
  assertDbUrl,
  assertStripeSecretKey,
  createSqlClientFromDbUrl,
  createStripeClientFromSecret,
} from '../src/script-runtime';
import { runStripeFullSync } from '../src/sync';

const SCRIPT_TAG = 'stripe sync';

async function main(): Promise<void> {
  const [secret, dbUrl] = await Promise.all([
    assertStripeSecretKey(SCRIPT_TAG),
    assertDbUrl(SCRIPT_TAG),
  ]);

  const stripe = createStripeClientFromSecret(secret);
  const sql = createSqlClientFromDbUrl(dbUrl);
  await sql.connect();
  try {
    const result = await runStripeFullSync({ stripe, sql });

    console.log(
      `[${SCRIPT_TAG}] done`,
      JSON.stringify({
        catalog: {
          products: result.catalog.products.length,
          prices: result.catalog.prices.length,
          dumpedToEntityStore: result.catalog.catalogDumped,
        },
        entities: {
          totalWritten: result.entities.totalWritten,
          perEntity: result.entities.perEntity,
        },
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
