/**
 * Top-level Stripe sync orchestrator — catalog reconcile only.
 *
 * Entity_store catalog dump / object backfills are paused until Stripe
 * rewires onto `@pkgs/entity-store`.
 */
import type Stripe from 'stripe';
import { type CatalogSyncResult, runStripeCatalogSync } from './catalog';

export type StripeFullSyncResult = {
  readonly catalog: CatalogSyncResult;
};

export async function runStripeFullSync(args: {
  readonly stripe: Stripe;
}): Promise<StripeFullSyncResult> {
  const catalog = await runStripeCatalogSync({ stripe: args.stripe });
  return { catalog };
}
