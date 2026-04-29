/**
 * Backfill all Stripe Disputes into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`dispute`, id=`dp_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('dispute').catch((e: unknown) => {
  console.error(
    '[stripe sync dispute] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
