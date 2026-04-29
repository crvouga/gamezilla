/**
 * Backfill all Stripe Invoices into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`invoice`, id=`in_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('invoice').catch((e: unknown) => {
  console.error(
    '[stripe sync invoice] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
