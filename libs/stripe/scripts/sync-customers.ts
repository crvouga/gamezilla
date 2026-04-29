/**
 * Backfill all Stripe Customers into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`customer`, id=`cus_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('customer').catch((e: unknown) => {
  console.error(
    '[stripe sync customer] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
