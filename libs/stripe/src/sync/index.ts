/**
 * Stripe sync module — pure orchestration decoupled from CLI entry points.
 *
 *   - {@link StripeCatalogSync} — declarative SPEC → Stripe Products/Prices
 *   - {@link StripeFullSync} — currently catalog-only (entity_store dump
 *     paused until `@pkgs/entity-store` rewire)
 */
export {
  type CatalogPriceSyncEntry,
  type CatalogProductSyncEntry,
  type CatalogSyncResult,
  STRIPE_CATALOG_PRODUCT_METADATA_KEY,
  StripeCatalogSync,
} from './catalog';
export { StripeFullSync, type StripeFullSyncResult } from './full';
