/**
 * Generic Stripe-list → EntityDb backfill.
 *
 * Each Stripe object has a stable `id` and `object` discriminator (e.g.
 * `customer`, `subscription`). We persist raw Stripe API payloads under
 * `namespace='stripe'`, `type=<object>`, `id=<object.id>`. This sits alongside
 * webhook-event rows (which use `type=event.type` like `customer.created`) so
 * the two sources never collide.
 */
import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import type Stripe from 'stripe';

export const STRIPE_ENTITY_NAMESPACE = 'stripe' as const;

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

/**
 * Stream a Stripe auto-paginating list into `EntityDb`. Uses the row's `object`
 * field to detect drift from `expectedObjectType` and aborts loudly — Stripe
 * occasionally returns related types (e.g. polymorphic refunds) and silent
 * mis-typing would break consumers downstream.
 */
export async function backfillStripeListIntoEntityDb<
  T extends StripeIdentifiable,
>(args: {
  readonly entityDb: EntityDb;
  readonly iterator: AsyncIterable<T>;
  readonly expectedObjectType: StripeEntityObjectType;
  /** Called every `progressEvery` rows; default 100. */
  readonly onProgress?: (p: BackfillProgress) => void;
  readonly progressEvery?: number;
}): Promise<{ readonly written: number }> {
  const {
    entityDb,
    iterator,
    expectedObjectType,
    onProgress,
    progressEvery = 100,
  } = args;
  const source = `${BACKFILL_METADATA_SOURCE_PREFIX}${expectedObjectType}`;
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
    await entityDb.upsert({
      namespace: STRIPE_ENTITY_NAMESPACE,
      type: expectedObjectType,
      id: obj.id,
      data: obj as unknown,
      metadata: { source },
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
 * handles entity-db wiring + logging + summary.
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
