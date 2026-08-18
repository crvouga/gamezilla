/**
 * Top-level Stripe sync orchestrator — catalog reconcile only.
 *
 * Entity_store catalog dump / object backfills are paused until Stripe
 * rewires onto `@pkgs/entity-store`.
 */
import type Stripe from 'stripe';
import { type CatalogSyncResult, StripeCatalogSync } from './catalog';

export type StripeFullSyncResult = {
  readonly catalog: CatalogSyncResult;
};

export class StripeFullSync {
  constructor(private readonly stripe: Stripe) {}

  async run(): Promise<StripeFullSyncResult> {
    const catalog = await new StripeCatalogSync(this.stripe).run();
    return { catalog };
  }
}
