import type { BillingEvent } from '@pkgs/billing';

type UnknownRecord = Record<string, unknown>;

/** Minimal shape of the fields we read from a Stripe event. */
export type StripeEventLike = {
  readonly type: string;
  readonly data: { readonly object: unknown };
};

const SUBSCRIPTION_EVENT_TYPES: Readonly<Record<string, true>> = {
  'customer.subscription.created': true,
  'customer.subscription.updated': true,
  'customer.subscription.deleted': true,
  'customer.subscription.paused': true,
  'customer.subscription.resumed': true,
};

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object'
    ? (value as UnknownRecord)
    : null;
}

function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(record: UnknownRecord | null, key: string): number | null {
  if (record === null) return null;
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(record: UnknownRecord, key: string): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}

/** Reads whichever of the (API-version dependent) period-end fields exists. */
function readPeriodEndMs(subscription: UnknownRecord): number | null {
  const items = asRecord(subscription['items']);
  const firstItem = Array.isArray(items?.['data'])
    ? asRecord(items['data'][0])
    : null;
  const seconds =
    readNumber(firstItem, 'current_period_end') ??
    readNumber(subscription, 'current_period_end');
  return seconds === null ? null : seconds * 1000;
}

/**
 * Maps a Stripe event onto the vendor-neutral subscription change. Failed
 * payments surface as `customer.subscription.updated` with `past_due`, so the
 * subscription events carry every access-relevant transition.
 */
export function translateStripeEvent(event: StripeEventLike): BillingEvent {
  if (SUBSCRIPTION_EVENT_TYPES[event.type] !== true) {
    return { kind: 'ignored', type: event.type };
  }
  const subscription = asRecord(event.data.object);
  if (subscription === null) return { kind: 'ignored', type: event.type };

  const items = asRecord(subscription['items']);
  const firstItem = Array.isArray(items?.['data'])
    ? asRecord(items['data'][0])
    : null;
  const price = asRecord(firstItem?.['price']);
  const metadata = asRecord(subscription['metadata']) ?? {};
  const status =
    event.type === 'customer.subscription.deleted'
      ? 'canceled'
      : (readString(subscription, 'status') ?? 'unknown');

  return {
    kind: 'subscription_changed',
    accountId: readString(metadata, 'accountId'),
    providerSubscriptionId: readString(subscription, 'id') ?? '',
    priceKey: readString(price ?? {}, 'lookup_key'),
    status,
    currentPeriodEndMs: readPeriodEndMs(subscription),
    cancelAtPeriodEnd:
      readBoolean(subscription, 'cancel_at_period_end') ?? false,
  };
}
