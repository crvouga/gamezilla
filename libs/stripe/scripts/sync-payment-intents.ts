/**
 * Backfill all Stripe PaymentIntents into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`payment_intent`, id=`pi_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('payment_intent').catch((e: unknown) => {
  console.error(
    '[stripe sync payment_intent] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
