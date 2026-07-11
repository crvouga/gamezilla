import type { SqlClient } from '@pkgs/sql-client/interface';
import type Stripe from 'stripe';
import { StripeAttr } from './stripe-attrs';
import {
  readStripeEntityStoreData,
  upsertStripeEntityStoreRow,
} from './server/entity-store-sql';

/** Entity-store type for catalog prices (checkout `priceKey` = external_id). */
export const STRIPE_PATCH_ENTITY_CATALOG_PRICE =
  'stripe.catalog-price' as const;

/** Entity-store type for catalog products. */
export const STRIPE_PATCH_ENTITY_CATALOG_PRODUCT =
  'stripe.catalog-product' as const;

/** Owner-scoped webhook delivery index (one row per Stripe object id). */
export const STRIPE_WEBHOOK_EVENT_ENTITY_TYPE = 'stripe.webhook-event' as const;

/** Full webhook payload cache keyed by `event.type::object.id`. */
export const STRIPE_WEBHOOK_EVENT_CACHE_ENTITY_TYPE =
  'stripe.webhook-event-cache' as const;

export const STRIPE_CATALOG_PRODUCT_METADATA_KEY =
  'catalog_product_id' as const;

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
  sql: SqlClient,
  priceLookupKey: string
): Promise<string | null> {
  const data = await readStripeEntityStoreData(sql, {
    patchEntityType: STRIPE_PATCH_ENTITY_CATALOG_PRICE,
    externalId: priceLookupKey,
  });
  if (data === null) return null;
  const payload = data[StripeAttr.payload.key] ?? data['payload'];
  return stripePriceIdFromCatalogRowData(payload);
}

export async function upsertCatalogPriceFromStripeApi(
  sql: SqlClient,
  rowId: string,
  price: Stripe.Price
): Promise<void> {
  await upsertStripeEntityStoreRow(sql, {
    patchEntityType: STRIPE_PATCH_ENTITY_CATALOG_PRICE,
    externalId: rowId,
    data: {
      ...StripeAttr.payload(price as unknown),
      ...StripeAttr.objectType('price'),
      ...StripeAttr.source('stripe_catalog_sync'),
    },
  });
}

export async function upsertCatalogProductFromStripeApi(
  sql: SqlClient,
  rowId: string,
  product: Stripe.Product
): Promise<void> {
  await upsertStripeEntityStoreRow(sql, {
    patchEntityType: STRIPE_PATCH_ENTITY_CATALOG_PRODUCT,
    externalId: rowId,
    data: {
      ...StripeAttr.payload(product as unknown),
      ...StripeAttr.objectType('product'),
      ...StripeAttr.source('stripe_catalog_sync'),
    },
  });
}
