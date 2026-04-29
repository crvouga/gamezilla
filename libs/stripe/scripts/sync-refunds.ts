/**
 * Backfill all Stripe Refunds into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`refund`, id=`re_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('refund').catch((e: unknown) => {
  console.error(
    '[stripe sync refund] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
