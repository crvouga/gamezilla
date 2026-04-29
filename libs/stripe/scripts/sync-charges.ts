/**
 * Backfill all Stripe Charges into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`charge`, id=`ch_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('charge').catch((e: unknown) => {
  console.error(
    '[stripe sync charge] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
