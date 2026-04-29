/**
 * Backfill all Stripe Subscriptions (every status) into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`subscription`, id=`sub_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('subscription').catch((e: unknown) => {
  console.error(
    '[stripe sync subscription] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
