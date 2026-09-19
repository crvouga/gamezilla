/**
 * Display helpers. Locale is pinned so the page reads the same everywhere the
 * mock runs; money is integer minor units.
 */
import type { MembershipStatus } from '@pkgs/billing';

import type {
  MockBillingMembership,
  MockBillingPrice,
} from '../shared/mock-billing-contract';

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

/** "in 7 days", "tomorrow", "today" — relative to the server clock. */
export function formatDaysUntil(targetMs: number, nowMs: number): string {
  const days = Math.ceil((targetMs - nowMs) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${String(days)} days`;
}

export function intervalLabel(price: MockBillingPrice): string {
  return price.interval === 'year' ? 'Yearly' : 'Monthly';
}

export function perInterval(price: MockBillingPrice): string {
  return `${formatMoney(price.unitAmount, price.currency)} / ${price.interval}`;
}

/** What a year costs on this price, in minor units. */
function yearlyCost(price: MockBillingPrice): number {
  return price.interval === 'year' ? price.unitAmount : price.unitAmount * 12;
}

/** Percent saved versus the most expensive price, or 0. */
export function savingsPercent(
  price: MockBillingPrice,
  prices: readonly MockBillingPrice[]
): number {
  const highest = Math.max(...prices.map(yearlyCost));
  if (highest <= 0) return 0;
  return Math.round((1 - yearlyCost(price) / highest) * 100);
}

/** A yearly price broken down per month, e.g. "$5.00 / month". */
export function monthlyEquivalent(price: MockBillingPrice): string | null {
  if (price.interval !== 'year') return null;
  return `${formatMoney(Math.round(price.unitAmount / 12), price.currency)} / month`;
}

export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export type StatusMeta = { readonly label: string; readonly tone: StatusTone };

const STATUS_META: Readonly<Record<MembershipStatus, StatusMeta>> = {
  trialing: { label: 'Free trial', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  delinquent: { label: 'Past due', tone: 'danger' },
  incomplete: { label: 'Incomplete', tone: 'warning' },
  ended: { label: 'Ended', tone: 'neutral' },
};

export function statusMeta(membership: MockBillingMembership): StatusMeta {
  if (membership.endsAtPeriodEnd && membership.status !== 'ended') {
    return { label: 'Canceling', tone: 'warning' };
  }
  return STATUS_META[membership.status];
}

export function isLive(membership: MockBillingMembership | null): boolean {
  return membership !== null && membership.status !== 'ended';
}
