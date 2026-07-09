/**
 * Generic Stripe-list → entity_store backfill.
 *
 * Each Stripe object has a stable `id` and `object` discriminator (e.g.
 * `customer`, `subscription`). We persist raw Stripe API payloads under
 * `namespace=stripe`, `type=<object>`, `external_id=<object.id>`, with owner
 * metadata in the JSON `data` column. This sits alongside webhook-event-cache
 * rows (`webhook-event-cache`, keyed by `event.type::object.id`) so the two
 * sources never collide.
 */
import type { SqlClient } from '@pkgs/sql-client/interface';
import type Stripe from 'stripe';
import {
  readStripeEntityStoreData,
  upsertStripeEntityStoreRow,
} from './server/entity-store-sql';
import { StripeAttr, StripeEntityAttr } from './stripe-attrs';

/** Marker on backfill rows so consumers can tell snapshots from webhook events. */
export const BACKFILL_METADATA_SOURCE_PREFIX = 'stripe_backfill_' as const;

export type StripeEntityObjectType =
  | 'customer'
  | 'subscription'
  | 'invoice'
  | 'charge'
  | 'payment_intent'
  | 'setup_intent'
  | 'refund'
  | 'dispute'
  | 'checkout.session';

/** Identifiable Stripe object — every list-API row has these. */
type StripeIdentifiable = { readonly id: string; readonly object: string };

export type BackfillProgress = {
  readonly type: StripeEntityObjectType;
  readonly written: number;
};

export function stripeObjectTypeToPatchEntityType(
  objectType: StripeEntityObjectType
): string {
  if (objectType === 'checkout.session') {
    return 'stripe.checkout-session';
  }
  if (objectType === 'payment_intent') {
    return 'stripe.payment-intent';
  }
  if (objectType === 'setup_intent') {
    return 'stripe.setup-intent';
  }
  return `stripe.${objectType}`;
}

function extractAccountIdFromCustomerMetadata(
  rec: Record<string, unknown>
): string | null {
  const meta = rec['metadata'];
  if (meta === null || typeof meta !== 'object' || !('account_id' in meta)) {
    return null;
  }
  const accountId = (meta as { account_id: unknown }).account_id;
  if (typeof accountId !== 'string') {
    return null;
  }
  const trimmed = accountId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractCustomerIdFromRef(customerRef: unknown): string | null {
  if (typeof customerRef === 'string') {
    return customerRef.startsWith('cus_') ? customerRef : null;
  }
  if (customerRef === null || typeof customerRef !== 'object') {
    return null;
  }
  if (!('id' in customerRef)) {
    return null;
  }
  const id = (customerRef as { id: unknown }).id;
  if (typeof id !== 'string' || !id.startsWith('cus_')) {
    return null;
  }
  return id;
}

async function lookupOwnerByCustomerId(
  sql: SqlClient,
  customerId: string
): Promise<string | null> {
  const data = await readStripeEntityStoreData(sql, {
    patchEntityType: 'stripe.customer',
    externalId: customerId,
  });
  if (data === null) return null;
  const owner = data[StripeEntityAttr.owner.key];
  return typeof owner === 'string' && owner.length > 0 ? owner : null;
}

async function resolveEntityOwner(args: {
  readonly sql: SqlClient;
  readonly obj: StripeIdentifiable;
  readonly expectedObjectType: StripeEntityObjectType;
}): Promise<string | null> {
  const { sql, obj, expectedObjectType } = args;
  const rec = obj as unknown as Record<string, unknown>;

  if (expectedObjectType === 'customer') {
    return extractAccountIdFromCustomerMetadata(rec);
  }

  const customerId = extractCustomerIdFromRef(rec['customer']);
  if (customerId === null) {
    return null;
  }
  return lookupOwnerByCustomerId(sql, customerId);
}

/**
 * Stream a Stripe auto-paginating list into entity_store. Uses the row's
 * `object` field to detect drift from `expectedObjectType` and aborts loudly.
 */
export async function backfillStripeListIntoEntityStore<
  T extends StripeIdentifiable,
>(args: {
  readonly sql: SqlClient;
  readonly iterator: AsyncIterable<T>;
  readonly expectedObjectType: StripeEntityObjectType;
  /** Called every `progressEvery` rows; default 100. */
  readonly onProgress?: (p: BackfillProgress) => void;
  readonly progressEvery?: number;
}): Promise<{ readonly written: number }> {
  const {
    sql,
    iterator,
    expectedObjectType,
    onProgress,
    progressEvery = 100,
  } = args;
  const source = `${BACKFILL_METADATA_SOURCE_PREFIX}${expectedObjectType}`;
  const patchEntityType = stripeObjectTypeToPatchEntityType(expectedObjectType);
  let written = 0;
  for await (const obj of iterator) {
    if (obj.object !== expectedObjectType) {
      throw new Error(
        `[stripe backfill] expected object="${expectedObjectType}" but received "${obj.object}" (id=${obj.id})`
      );
    }
    if (typeof obj.id !== 'string' || obj.id.length === 0) {
      throw new Error(
        `[stripe backfill] missing id on ${expectedObjectType} row`
      );
    }
    const owner = await resolveEntityOwner({
      sql,
      obj,
      expectedObjectType,
    });
    const data: Record<string, unknown> = {
      ...StripeAttr.payload(obj as unknown),
      ...StripeAttr.objectType(expectedObjectType),
      ...StripeAttr.source(source),
    };
    if (owner !== null) {
      Object.assign(data, StripeEntityAttr.owner(owner));
    }
    await upsertStripeEntityStoreRow(sql, {
      patchEntityType,
      externalId: obj.id,
      ...(owner !== null ? { ownerId: owner } : {}),
      data,
    });
    written += 1;
    if (onProgress !== undefined && written % progressEvery === 0) {
      onProgress({ type: expectedObjectType, written });
    }
  }
  return { written };
}

/**
 * Bind list-API params for one entity type. Each per-entity script provides a
 * `runner` that returns the auto-paginating iterator; the shared runner here
 * handles entity_store wiring + logging + summary.
 */
export type EntityBackfillRunner = (args: {
  readonly stripe: Stripe;
}) => AsyncIterable<StripeIdentifiable>;

export const ENTITY_BACKFILL_RUNNERS: Readonly<
  Record<StripeEntityObjectType, EntityBackfillRunner>
> = {
  customer: ({ stripe }) =>
    stripe.customers.list({ limit: 100 }) as AsyncIterable<StripeIdentifiable>,
  subscription: ({ stripe }) =>
    stripe.subscriptions.list({
      status: 'all',
      limit: 100,
    }) as AsyncIterable<StripeIdentifiable>,
  invoice: ({ stripe }) =>
    stripe.invoices.list({ limit: 100 }) as AsyncIterable<StripeIdentifiable>,
  charge: ({ stripe }) =>
    stripe.charges.list({ limit: 100 }) as AsyncIterable<StripeIdentifiable>,
  payment_intent: ({ stripe }) =>
    stripe.paymentIntents.list({
      limit: 100,
    }) as AsyncIterable<StripeIdentifiable>,
  setup_intent: ({ stripe }) =>
    stripe.setupIntents.list({
      limit: 100,
    }) as AsyncIterable<StripeIdentifiable>,
  refund: ({ stripe }) =>
    stripe.refunds.list({ limit: 100 }) as AsyncIterable<StripeIdentifiable>,
  dispute: ({ stripe }) =>
    stripe.disputes.list({ limit: 100 }) as AsyncIterable<StripeIdentifiable>,
  'checkout.session': ({ stripe }) =>
    stripe.checkout.sessions.list({
      limit: 100,
    }) as AsyncIterable<StripeIdentifiable>,
};

export const ALL_BACKFILL_ENTITY_TYPES: readonly StripeEntityObjectType[] = [
  'customer',
  'subscription',
  'invoice',
  'charge',
  'payment_intent',
  'setup_intent',
  'refund',
  'dispute',
  'checkout.session',
] as const;
