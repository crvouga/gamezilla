/**
 * Stripe sync module — pure orchestration decoupled from CLI entry points.
 *
 * Granular pieces:
 *   - {@link runStripeCatalogSync} — declarative SPEC → Stripe Products/Prices
 *     (+ optional patch-db dump).
 *   - {@link runStripeEntitiesSync} — backfill every Stripe object type into
 *     patch-db (also exposes {@link runStripeEntityBackfill} for one-offs).
 *   - {@link runStripeWebhookSync} — reconcile a single `*` webhook endpoint
 *     and write its `whsec_` to Vault.
 *
 * Composed:
 *   - {@link runStripeFullSync} — catalog → entities → webhooks on a single
 *     shared Stripe + PatchDb + Vault CLI; this is what `scripts/sync.ts`
 *     calls and what deploys invoke.
 */
export {
  runStripeCatalogSync,
  type CatalogPriceSyncEntry,
  type CatalogProductSyncEntry,
  type CatalogSyncResult,
} from './catalog';
export {
  runStripeEntitiesSync,
  runStripeEntityBackfill,
  type EntitiesSyncEntry,
  type EntitiesSyncResult,
} from './entities';
export { runStripeFullSync, type StripeFullSyncResult } from './full';
export { runStripeWebhookSync, type WebhookSyncResult } from './webhooks';
