/**
 * PatchDB entity schemas for the Stripe mirror.
 *
 * Stripe entity types are derived from {@link StripeEntityObjectType}
 * (`customer`, `subscription`, `invoice`, …) and the two catalog mirror
 * types. Every Stripe entity row carries the same `stripe/*` attributes
 * (payload, object-type, source) plus the cross-cutting `entity/owner` for
 * ABAC scoping.
 */
import { AbacEntityAttr } from '@pkgs/patch-db/abac/abac-entity-attr';
import {
  defineEntitySchema,
  type EntitySchema,
} from '@pkgs/patch-db/schema/entity-schema';
import {
  ALL_BACKFILL_ENTITY_TYPES,
  stripeObjectTypeToPatchEntityType,
  type StripeEntityObjectType,
} from './backfill-entities';
import {
  STRIPE_PATCH_ENTITY_CATALOG_PRICE,
  STRIPE_PATCH_ENTITY_CATALOG_PRODUCT,
} from './stripe-catalog-mirror';
import { StripeAttr } from './stripe-attrs';

/** Attributes shared by every Stripe-mirrored entity. */
const STRIPE_COMMON_ATTRS = {
  payload: StripeAttr.payload,
  objectType: StripeAttr.objectType,
  source: StripeAttr.source,
  webhookEventType: StripeAttr.webhookEventType,
  stripeObjectId: StripeAttr.stripeObjectId,
  owner: AbacEntityAttr.owner,
} as const;

function makeStripeSchema(entityType: string): EntitySchema {
  return defineEntitySchema({
    entityType,
    attributes: STRIPE_COMMON_ATTRS,
  });
}

/** Stripe customer / subscription / invoice / etc. — one schema per
 * {@link StripeEntityObjectType}. */
export const STRIPE_ENTITY_SCHEMAS_BY_OBJECT: Readonly<
  Record<StripeEntityObjectType, EntitySchema>
> = Object.fromEntries(
  ALL_BACKFILL_ENTITY_TYPES.map((obj) => [
    obj,
    makeStripeSchema(stripeObjectTypeToPatchEntityType(obj)),
  ])
) as Readonly<Record<StripeEntityObjectType, EntitySchema>>;

/** System-only catalog mirror (price). */
export const StripeCatalogPriceSchema: EntitySchema = makeStripeSchema(
  STRIPE_PATCH_ENTITY_CATALOG_PRICE
);

/** System-only catalog mirror (product). */
export const StripeCatalogProductSchema: EntitySchema = makeStripeSchema(
  STRIPE_PATCH_ENTITY_CATALOG_PRODUCT
);

/** Owner-scoped webhook delivery index (one row per Stripe object id). */
export const STRIPE_WEBHOOK_EVENT_ENTITY_TYPE = 'stripe.webhook-event' as const;

/** Full webhook payload cache keyed by `event.type::object.id`. */
export const STRIPE_WEBHOOK_EVENT_CACHE_ENTITY_TYPE =
  'stripe.webhook-event-cache' as const;

export const StripeWebhookEventSchema: EntitySchema = defineEntitySchema({
  entityType: STRIPE_WEBHOOK_EVENT_ENTITY_TYPE,
  attributes: {
    webhookEventType: StripeAttr.webhookEventType,
    stripeObjectId: StripeAttr.stripeObjectId,
    owner: AbacEntityAttr.owner,
  },
});

export const StripeWebhookEventCacheSchema: EntitySchema = makeStripeSchema(
  STRIPE_WEBHOOK_EVENT_CACHE_ENTITY_TYPE
);

export const ALL_STRIPE_ENTITY_SCHEMAS: readonly EntitySchema[] = [
  ...Object.values(STRIPE_ENTITY_SCHEMAS_BY_OBJECT),
  StripeCatalogPriceSchema,
  StripeCatalogProductSchema,
  StripeWebhookEventSchema,
  StripeWebhookEventCacheSchema,
];
