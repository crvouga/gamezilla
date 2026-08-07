/**
 * Stripe sync module — pure orchestration decoupled from CLI entry points.
 *
 *   - {@link runStripeCatalogSync} — declarative SPEC → Stripe Products/Prices
 *   - {@link runStripeFullSync} — currently catalog-only (entity_store dump
 *     paused until `@pkgs/entity-store` rewire)
 */
export {
  type CatalogPriceSyncEntry,
  type CatalogProductSyncEntry,
  type CatalogSyncResult,
  runStripeCatalogSync,
  STRIPE_CATALOG_PRODUCT_METADATA_KEY,
} from './catalog';
export { runStripeFullSync, type StripeFullSyncResult } from './full';
