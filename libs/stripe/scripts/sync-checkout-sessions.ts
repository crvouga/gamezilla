/**
 * Backfill all Stripe Checkout Sessions into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`checkout.session`, id=`cs_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('checkout.session').catch((e: unknown) => {
  console.error(
    '[stripe sync checkout.session] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
