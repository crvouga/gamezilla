/**
 * Stripe sync module — pure orchestration decoupled from CLI entry points.
 *
 * Granular pieces:
 *   - {@link runStripeCatalogSync} — declarative SPEC → Stripe Products/Prices
 *     (+ optional entity_store dump).
 *   - {@link runStripeEntitiesSync} — backfill every Stripe object type into
 *     entity_store (also exposes {@link runStripeEntityBackfill} for one-offs).
 *
 * Composed:
 *   - {@link runStripeFullSync} — catalog → entities on a single shared Stripe
 *     + SqlClient; this is what `scripts/sync.ts` calls and what deploys invoke.
 */
export {
  type CatalogPriceSyncEntry,
  type CatalogProductSyncEntry,
  type CatalogSyncResult,
  runStripeCatalogSync,
} from './catalog';
export {
  type EntitiesSyncEntry,
  type EntitiesSyncResult,
  runStripeEntitiesSync,
  runStripeEntityBackfill,
} from './entities';
export { runStripeFullSync, type StripeFullSyncResult } from './full';
