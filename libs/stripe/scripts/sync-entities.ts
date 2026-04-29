/**
 * Backfill ALL Stripe entity types in a stable order on one shared DB connection.
 *
 * Order: customer → subscription → invoice → charge → payment_intent →
 * setup_intent → refund → dispute → checkout.session.
 *
 * Requires Doppler-resolvable `STRIPE_SECRET_KEY` and postgres `DB_URL`.
 *
 * Note: this does NOT cover catalog products/prices — those have their own
 * declarative SPEC reconciliation in `sync-catalog.ts`.
 */
import { runAllStripeEntityBackfills } from '../src/backfill-runner';

await runAllStripeEntityBackfills().catch((e: unknown) => {
  console.error(
    '[stripe sync entities] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
