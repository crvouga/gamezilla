/**
 * Generic Stripe-list → patch-db backfill.
 *
 * Each Stripe object has a stable `id` and `object` discriminator (e.g.
 * `customer`, `subscription`). We persist raw Stripe API payloads under
 * `entityType=stripe.<object>` (with `checkout.session` → `stripe.checkout_session`),
 * `entityId=<object.id>`, attribute `stripe/payload`. This sits alongside
 * webhook-event rows (`stripe.<event.type>`) so the two sources never collide.
 */
import type { PatchDb, PatchDbContext } from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@gamezilla/patch-db/policy/system-device';
import type Stripe from 'stripe';

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
    return 'stripe.checkout_session';
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
  db: PatchDb,
  ctx: PatchDbContext,
  customerId: string
): Promise<string | null> {
  const [r] = await db.read(
    [
      {
        entityType: 'stripe.customer',
        entityId: customerId,
        limit: 1,
      },
    ],
    ctx
  );
  const owner = r?.entities[0]?.attributes['entity/owner'];
  return typeof owner === 'string' && owner.length > 0 ? owner : null;
}

async function resolveEntityOwner(args: {
  readonly db: PatchDb;
  readonly ctx: PatchDbContext;
  readonly obj: StripeIdentifiable;
  readonly expectedObjectType: StripeEntityObjectType;
}): Promise<string | null> {
  const { db, ctx, obj, expectedObjectType } = args;
  const rec = obj as unknown as Record<string, unknown>;

  if (expectedObjectType === 'customer') {
    return extractAccountIdFromCustomerMetadata(rec);
  }

  const customerId = extractCustomerIdFromRef(rec['customer']);
  if (customerId === null) {
    return null;
  }
  return lookupOwnerByCustomerId(db, ctx, customerId);
}

/**
 * Stream a Stripe auto-paginating list into patch-db. Uses the row's `object`
 * field to detect drift from `expectedObjectType` and aborts loudly — Stripe
 * occasionally returns related types (e.g. polymorphic refunds) and silent
 * mis-typing would break consumers downstream.
 */
export async function backfillStripeListIntoPatchDb<
  T extends StripeIdentifiable,
>(args: {
  readonly db: PatchDb;
  readonly ctx: PatchDbContext;
  readonly iterator: AsyncIterable<T>;
  readonly expectedObjectType: StripeEntityObjectType;
  /** Called every `progressEvery` rows; default 100. */
  readonly onProgress?: (p: BackfillProgress) => void;
  readonly progressEvery?: number;
}): Promise<{ readonly written: number }> {
  const {
    db,
    ctx,
    iterator,
    expectedObjectType,
    onProgress,
    progressEvery = 100,
  } = args;
  const source = `${BACKFILL_METADATA_SOURCE_PREFIX}${expectedObjectType}`;
  const entityType = stripeObjectTypeToPatchEntityType(expectedObjectType);
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
      db,
      ctx,
      obj,
      expectedObjectType,
    });
    const attrs: Record<string, unknown> = {
      'stripe/payload': obj as unknown,
      'stripe/objectType': expectedObjectType,
      'stripe/source': source,
      'patch/createdBy': PATCH_DB_SYSTEM_DEVICE_ID,
    };
    if (owner !== null) {
      attrs['entity/owner'] = owner;
    }
    await db.write(
      [
        {
          entityId: obj.id,
          entityType,
          attributes: attrs,
        },
      ],
      ctx
    );
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
 * handles patch-db wiring + logging + summary.
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
