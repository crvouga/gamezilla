import type { PatchDb, PatchDbContext } from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@gamezilla/patch-db/policy/system-device';
import type Stripe from 'stripe';

/** Patch-db entity type for catalog prices (SPEC / checkout `priceKey` = entityId). */
export const STRIPE_PATCH_ENTITY_CATALOG_PRICE =
  'stripe.catalog_price' as const;

/** Patch-db entity type for catalog products (`catalog_product_id` metadata = entityId). */
export const STRIPE_PATCH_ENTITY_CATALOG_PRODUCT =
  'stripe.catalog_product' as const;

/** Stripe Product metadata — must match `src/sync/catalog.ts`. */
export const STRIPE_CATALOG_PRODUCT_METADATA_KEY =
  'catalog_product_id' as const;

/** Read Stripe Price `id` from `stripe/payload` on a catalog_price entity. */
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
  db: PatchDb,
  ctx: PatchDbContext,
  priceLookupKey: string
): Promise<string | null> {
  const [res] = await db.read(
    [
      {
        entityType: STRIPE_PATCH_ENTITY_CATALOG_PRICE,
        entityId: priceLookupKey,
        limit: 1,
      },
    ],
    ctx
  );
  const ent = res?.entities[0];
  if (ent === undefined) return null;
  const payload = ent.attributes['stripe/payload'];
  return stripePriceIdFromCatalogRowData(payload);
}

/**
 * Persist raw Stripe API Price payload (e.g. `prices.retrieve`) — no shaping.
 * `rowId` is the stable catalog key (SPEC / checkout `priceKey`).
 */
export async function upsertCatalogPriceFromStripeApi(
  db: PatchDb,
  ctx: PatchDbContext,
  rowId: string,
  price: Stripe.Price
): Promise<void> {
  await db.write(
    [
      {
        entityId: rowId,
        entityType: STRIPE_PATCH_ENTITY_CATALOG_PRICE,
        attributes: {
          'stripe/payload': price as unknown,
          'stripe/objectType': 'price',
          'stripe/source': 'stripe_catalog_sync',
          'patch/createdById': PATCH_DB_SYSTEM_DEVICE_ID,
        },
      },
    ],
    ctx
  );
}

/**
 * Persist raw Stripe API Product payload (e.g. `products.retrieve`) — no shaping.
 * `rowId` is `metadata.catalog_product_id` for that product.
 */
export async function upsertCatalogProductFromStripeApi(
  db: PatchDb,
  ctx: PatchDbContext,
  rowId: string,
  product: Stripe.Product
): Promise<void> {
  await db.write(
    [
      {
        entityId: rowId,
        entityType: STRIPE_PATCH_ENTITY_CATALOG_PRODUCT,
        attributes: {
          'stripe/payload': product as unknown,
          'stripe/objectType': 'product',
          'stripe/source': 'stripe_catalog_sync',
          'patch/createdById': PATCH_DB_SYSTEM_DEVICE_ID,
        },
      },
    ],
    ctx
  );
}
