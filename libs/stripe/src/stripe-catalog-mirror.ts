import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import type Stripe from 'stripe';

/** Namespace shared with Stripe webhook cache rows. */
export const STRIPE_CATALOG_NAMESPACE = 'stripe' as const;

/** Row `id` matches checkout `priceKey` / SPEC price key (same as Stripe `lookup_key`). */
export const STRIPE_CATALOG_PRICE_TYPE = 'catalog_price' as const;

/** Row `id` is `catalog_product_id` metadata value on the Product (e.g. `subscription`). */
export const STRIPE_CATALOG_PRODUCT_TYPE = 'catalog_product' as const;

/** Stripe Product metadata — must match sync-catalog. */
export const STRIPE_CATALOG_PRODUCT_METADATA_KEY =
  'catalog_product_id' as const;

/** Read Stripe Price `id` from a row produced by {@link upsertCatalogPriceFromStripeApi}. */
export function stripePriceIdFromCatalogRowData(data: unknown): string | null {
  if (
    data !== null &&
    typeof data === 'object' &&
    'id' in data &&
    typeof (data as { id: unknown }).id === 'string'
  ) {
    return (data as { id: string }).id;
  }
  return null;
}

export async function getStripeCatalogPriceStripeId(
  entityDb: EntityDb,
  priceLookupKey: string
): Promise<string | null> {
  const row = await entityDb.get({
    namespace: STRIPE_CATALOG_NAMESPACE,
    type: STRIPE_CATALOG_PRICE_TYPE,
    id: priceLookupKey,
  });
  return row === null ? null : stripePriceIdFromCatalogRowData(row.data);
}

/**
 * Persist raw Stripe API Price payload (e.g. `prices.retrieve`) — no shaping.
 * `rowId` is the stable catalog key (SPEC / checkout `priceKey`).
 */
export async function upsertCatalogPriceFromStripeApi(
  entityDb: EntityDb,
  rowId: string,
  price: Stripe.Price
): Promise<void> {
  await entityDb.upsert({
    namespace: STRIPE_CATALOG_NAMESPACE,
    type: STRIPE_CATALOG_PRICE_TYPE,
    id: rowId,
    data: price as unknown,
    metadata: { source: 'stripe_catalog_sync' },
  });
}

/**
 * Persist raw Stripe API Product payload (e.g. `products.retrieve`) — no shaping.
 * `rowId` is `metadata.catalog_product_id` for that product.
 */
export async function upsertCatalogProductFromStripeApi(
  entityDb: EntityDb,
  rowId: string,
  product: Stripe.Product
): Promise<void> {
  await entityDb.upsert({
    namespace: STRIPE_CATALOG_NAMESPACE,
    type: STRIPE_CATALOG_PRODUCT_TYPE,
    id: rowId,
    data: product as unknown,
    metadata: { source: 'stripe_catalog_sync' },
  });
}
