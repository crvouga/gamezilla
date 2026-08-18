/**
 * Single Stripe sync entry point — catalog reconcile.
 *
 * Reads via secret store (`SECRETS_TOKEN` or secrets CLI login):
 *   - `STRIPE_SECRET_KEY` (required)
 *
 * Postgres / entity_store persistence is intentionally skipped until Stripe
 * rewires onto `@pkgs/entity-store`.
 */
import {
  assertStripeSecretKey,
  createStripeClientFromSecret,
} from '../src/shared/stripe/script-runtime';
import { StripeFullSync } from '../src/use-cases/sync-catalog/server/sync';

const SCRIPT_TAG = 'stripe sync';

async function main(): Promise<void> {
  const secret = await assertStripeSecretKey(SCRIPT_TAG);
  const stripe = createStripeClientFromSecret(secret);
  const result = await new StripeFullSync(stripe).run();

  console.log(
    `[${SCRIPT_TAG}] done`,
    JSON.stringify({
      catalog: {
        products: result.catalog.products.length,
        prices: result.catalog.prices.length,
      },
    })
  );
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
