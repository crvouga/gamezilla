import type Stripe from 'stripe';

/**
 * Primary key for webhook cache rows: Stripe object `id` when present,
 * otherwise the event id.
 */
export function stripeEventObjectId(event: Stripe.Event): string {
  const raw = event.data.object as unknown;
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'id' in raw &&
    typeof raw?.id === 'string'
  ) {
    return raw?.id;
  }
  return event.id;
}

/** Stable cache key: one row per `(event type, Stripe object id)` pair. */
export function stripeWebhookEventCacheEntityId(
  eventType: string,
  objectId: string
): string {
  return `${eventType}::${objectId}`;
}
