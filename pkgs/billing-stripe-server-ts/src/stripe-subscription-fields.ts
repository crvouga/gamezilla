/**
 * Reading Stripe's subscription and customer objects into the port's
 * vocabulary: the one place a Stripe field name is read.
 */
import type { Membership } from '@pkgs/billing-root-shared-ts/membership';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared-ts/offer';
import { membershipStatusOf } from '@pkgs/billing-stripe-shared-ts/membership-status';

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object'
    ? (value as UnknownRecord)
    : null;
}

export function readString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readBoolean(record: UnknownRecord, key: string): boolean {
  return record[key] === true;
}

export function readNumber(
  record: UnknownRecord | null,
  key: string
): number | null {
  if (record === null) return null;
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A field holding an id, or the expanded object when a caller expanded it. */
export function readId(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string') return value.length > 0 ? value : null;
  const expanded = asRecord(value);
  return expanded === null ? null : readString(expanded, 'id');
}

export function firstItem(subscription: UnknownRecord): UnknownRecord | null {
  const items = asRecord(subscription['items']);
  return Array.isArray(items?.['data']) ? asRecord(items['data'][0]) : null;
}

/** Reads whichever of the (API-version dependent) period-end fields exists. */
export function readPeriodEndMs(subscription: UnknownRecord): number | null {
  const seconds =
    readNumber(firstItem(subscription), 'current_period_end') ??
    readNumber(subscription, 'current_period_end');
  return seconds === null ? null : seconds * 1000;
}

/** Which of our offer prices the subscription's first item is charged at. */
export function readOfferPriceKey(
  subscription: UnknownRecord,
  offer: PlusMembershipOffer
): string | null {
  const price = asRecord(firstItem(subscription)?.['price']);
  const catalogPriceId =
    price === null ? null : readString(price, 'lookup_key');
  if (catalogPriceId === null) return null;
  for (const [key, spec] of Object.entries(offer.prices)) {
    if (spec.catalogPriceId === catalogPriceId) return key;
  }
  return null;
}

/**
 * When access runs out. A subscription canceled immediately keeps its
 * `current_period_end` in the future, so an ended one ends at `ended_at` when
 * that came first — the paid period it lost is not a period it still has.
 */
export function accessEndMs(
  subscription: UnknownRecord,
  ended: boolean
): number | null {
  const periodEndMs = readPeriodEndMs(subscription);
  const endedAtS = readNumber(subscription, 'ended_at');
  if (!ended || endedAtS === null) return periodEndMs;
  const endedAtMs = endedAtS * 1000;
  return periodEndMs === null ? endedAtMs : Math.min(periodEndMs, endedAtMs);
}

/**
 * Stripe's customer balance is negative when the customer has credit. The
 * port's credit is that amount in cents, and never below nothing. A payload
 * that is not a customer (or has no balance) is unread.
 */
export function creditCentsFromCustomer(
  record: UnknownRecord | null
): number | undefined {
  if (record === null || record['object'] !== 'customer') return undefined;
  if (record['deleted'] === true) return 0;
  const balance = readNumber(record, 'balance');
  if (balance === null) return undefined;
  return Math.max(0, -Math.trunc(balance));
}

export function toMembership(
  subscription: UnknownRecord,
  forcedEnded: boolean
): Membership {
  const status = forcedEnded
    ? 'ended'
    : membershipStatusOf(readString(subscription, 'status') ?? '');
  return {
    status,
    periodEndMs: accessEndMs(subscription, status === 'ended'),
    endsAtPeriodEnd:
      status !== 'ended' && readBoolean(subscription, 'cancel_at_period_end'),
  };
}
