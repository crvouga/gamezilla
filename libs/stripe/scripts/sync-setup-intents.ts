/**
 * Backfill all Stripe SetupIntents into EntityDb.
 *
 * Rows: namespace=`stripe`, type=`setup_intent`, id=`seti_…`.
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 */
import { runStripeEntityBackfill } from '../src/backfill-runner';

await runStripeEntityBackfill('setup_intent').catch((e: unknown) => {
  console.error(
    '[stripe sync setup_intent] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
