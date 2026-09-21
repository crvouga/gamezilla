/**
 * Display helpers. Locale is pinned so the pages read the same everywhere the
 * provider runs; money is integer minor units.
 */
import type {
  MockInvoiceStatus,
  MockSubscriptionStatus,
} from '@pkgs/billing-mock/wire';

import type { PagePrice, PortalSubscription } from '../../src/shared/pages';

const LOCALE = 'en-US';
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatMoney(unitAmount: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100);
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(ms);
}

export function formatShortDate(ms: number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(ms);
}

/** "in 7 days", "tomorrow", "today" — relative to the customer's clock. */
export function formatDaysUntil(targetMs: number, nowMs: number): string {
  const days = Math.ceil((targetMs - nowMs) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${String(days)} days`;
}

/** `too_expensive` → "Too expensive". */
export function humanize(value: string): string {
  const words = value.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function priceKeyOf(price: PagePrice): string {
  return price.lookupKey ?? price.id;
}

export function intervalLabel(price: PagePrice): string {
  return price.nickname ?? (price.interval === 'year' ? 'Yearly' : 'Monthly');
}

export function perInterval(price: PagePrice): string {
  return `${formatMoney(price.unitAmount, price.currency)} / ${price.interval}`;
}

/** What a year costs on this price, in minor units. */
function yearlyCost(price: PagePrice): number {
  return price.interval === 'year' ? price.unitAmount : price.unitAmount * 12;
}

/** Percent saved versus the most expensive price, or 0. */
export function savingsPercent(
  price: PagePrice,
  prices: readonly PagePrice[]
): number {
  const highest = Math.max(...prices.map(yearlyCost));
  if (highest <= 0) return 0;
  return Math.round((1 - yearlyCost(price) / highest) * 100);
}

/** A yearly price broken down per month, e.g. "$5.00 / month". */
export function monthlyEquivalent(price: PagePrice): string | null {
  if (price.interval !== 'year') return null;
  return `${formatMoney(Math.round(price.unitAmount / 12), price.currency)} / month`;
}

export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export type StatusMeta = { readonly label: string; readonly tone: StatusTone };

const STATUS_META: Readonly<Record<MockSubscriptionStatus, StatusMeta>> = {
  trialing: { label: 'Free trial', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  past_due: { label: 'Past due', tone: 'danger' },
  canceled: { label: 'Canceled', tone: 'neutral' },
  unpaid: { label: 'Unpaid', tone: 'danger' },
  incomplete: { label: 'Incomplete', tone: 'warning' },
  incomplete_expired: { label: 'Expired', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'neutral' },
};

export function statusMeta(subscription: PortalSubscription): StatusMeta {
  if (subscription.cancelAtPeriodEnd && isLive(subscription)) {
    return { label: 'Canceling', tone: 'warning' };
  }
  return STATUS_META[subscription.status];
}

export const INVOICE_STATUS_META: Readonly<
  Record<MockInvoiceStatus, StatusMeta>
> = {
  paid: { label: 'Paid', tone: 'success' },
  open: { label: 'Open', tone: 'warning' },
  draft: { label: 'Draft', tone: 'neutral' },
  void: { label: 'Void', tone: 'neutral' },
  uncollectible: { label: 'Uncollectible', tone: 'danger' },
};

/** A subscription the customer can still manage (not ended for good). */
export function isLive(subscription: PortalSubscription | null): boolean {
  return (
    subscription !== null &&
    subscription.status !== 'canceled' &&
    subscription.status !== 'incomplete_expired'
  );
}
