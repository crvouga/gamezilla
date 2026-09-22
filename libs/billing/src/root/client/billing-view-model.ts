/**
 * What the billing screen shows, as a pure function of the caller's plan tier,
 * their synced membership row and the deployment's billing switch. The screen
 * renders this and nothing else, so every combination is testable without a
 * DOM.
 */
import type { OfferPriceSpec, PlusMembershipOffer } from '@pkgs/billing';

import type { MembershipRow } from '../../use-cases/load-my-subscription/shared/membership-row';

export type { MembershipRow };

export type BillingTier = 'guest' | 'free' | 'paid';

/** The membership as the person understands it. */
export type MembershipState =
  | 'none'
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'canceling'
  | 'delinquent'
  | 'ended';

export type BillingPrimaryAction = 'subscribe' | 'sign_in' | 'none';

export type BillingNotice = 'unavailable' | 'delinquent' | 'incomplete';

export type BillingViewInput = {
  readonly tier: BillingTier;
  readonly billingEnabled: boolean;
  /** The live policy grants `billing:subscribe` / `billing:manage`. */
  readonly canSubscribe: boolean;
  readonly canManage: boolean;
  /** The account already has a provider customer (it can open the portal). */
  readonly hasCustomer: boolean;
  readonly row: MembershipRow | null;
  readonly nowMs: number;
};

export type BillingView = {
  readonly tier: BillingTier;
  readonly state: MembershipState;
  /** Trial end, renewal, access end or end — whichever `state` is about. */
  readonly periodEndMs: number | null;
  /** Whole days until `periodEndMs` (never negative), when it is ahead. */
  readonly daysLeft: number | null;
  /** The offer price the membership is on, when known. */
  readonly priceKey: string | null;
  readonly primary: BillingPrimaryAction;
  readonly manage: boolean;
  readonly notice: BillingNotice | null;
  /** The offer's prices and benefits (hidden while billing is off). */
  readonly showPricing: boolean;
};

const DAY_MS = 86_400_000;

/**
 * An unreadable row — blank or unknown status — is "no membership", the same
 * reading the access policy makes, so the screen never promises what access
 * does not grant.
 */
export function membershipStateOf(row: MembershipRow | null): MembershipState {
  const canceling =
    row?.cancel_at_period_end === true || row?.cancel_at_period_end === 1;
  switch (row?.status) {
    case 'incomplete':
      return 'incomplete';
    case 'trialing':
      return canceling ? 'canceling' : 'trialing';
    case 'active':
      return canceling ? 'canceling' : 'active';
    case 'delinquent':
      return 'delinquent';
    case 'ended':
      return 'ended';
    default:
      return 'none';
  }
}

function periodEndOf(row: MembershipRow | null): number | null {
  if (row === null || row.current_period_end === null) return null;
  const parsed = Date.parse(row.current_period_end);
  return Number.isFinite(parsed) ? parsed : null;
}

function primaryOf(
  input: BillingViewInput,
  state: MembershipState
): BillingPrimaryAction {
  if (!input.billingEnabled) return 'none';
  if (input.tier === 'guest') return 'sign_in';
  if (input.tier === 'paid') return 'none';
  // A delinquent member fixes their card in the portal; a second checkout
  // would start a second subscription.
  const open = state === 'none' || state === 'incomplete' || state === 'ended';
  return open && input.canSubscribe ? 'subscribe' : 'none';
}

function noticeOf(
  input: BillingViewInput,
  state: MembershipState
): BillingNotice | null {
  if (!input.billingEnabled) return 'unavailable';
  if (state === 'delinquent') return 'delinquent';
  if (state === 'incomplete') return 'incomplete';
  return null;
}

export function buildBillingView(input: BillingViewInput): BillingView {
  // A guest has no account, so a row left on the device says nothing about them.
  const row = input.tier === 'guest' ? null : input.row;
  const state = membershipStateOf(row);
  const periodEndMs =
    state === 'none' || state === 'incomplete' ? null : periodEndOf(row);
  const primary = primaryOf(input, state);
  return {
    tier: input.tier,
    state,
    periodEndMs,
    daysLeft:
      periodEndMs === null || periodEndMs < input.nowMs
        ? null
        : Math.ceil((periodEndMs - input.nowMs) / DAY_MS),
    priceKey: state === 'none' ? null : (row?.price_key ?? null),
    primary,
    manage:
      input.billingEnabled &&
      input.tier !== 'guest' &&
      input.canManage &&
      input.hasCustomer,
    notice: noticeOf(input, state),
    showPricing: input.billingEnabled,
  };
}

export type PriceSummary = {
  readonly key: string;
  readonly interval: OfferPriceSpec['interval'];
  readonly unitAmount: number;
  readonly currency: string;
  /** Monthly-equivalent amount, in minor units (rounded down). */
  readonly perMonthAmount: number;
  /** Whole-percent saving against paying monthly for a year, else `null`. */
  readonly savingsPercent: number | null;
  readonly trialDays: number;
};

/** The offer's switchable prices, in offer order, with savings. */
export function summarizeOffer(
  offer: PlusMembershipOffer
): readonly PriceSummary[] {
  const specs = offer.switchablePriceKeys.flatMap((key) => {
    const spec = offer.prices[key];
    return spec === undefined ? [] : [spec];
  });
  const monthly = specs.find((spec) => spec.interval === 'month');
  return specs.map((spec) => {
    const months = spec.interval === 'year' ? 12 : 1;
    const fullPrice =
      monthly !== undefined && monthly.currency === spec.currency
        ? monthly.unitAmount * months
        : null;
    const savings =
      fullPrice === null || fullPrice <= 0 || spec.interval === 'month'
        ? null
        : Math.round((1 - spec.unitAmount / fullPrice) * 100);
    return {
      key: spec.key,
      interval: spec.interval,
      unitAmount: spec.unitAmount,
      currency: spec.currency,
      perMonthAmount: Math.floor(spec.unitAmount / months),
      savingsPercent: savings !== null && savings > 0 ? savings : null,
      trialDays: spec.trialPeriodDays ?? 0,
    };
  });
}

/** Formats integer minor units in `currency` for `locale`. */
export function formatMinorUnits(
  amount: number,
  currency: string,
  locale: string
): string {
  const format = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
}

export type MembershipMenuEntry = {
  readonly tier: BillingTier;
  /** A paying member: the chip takes the brand tone. */
  readonly highlighted: boolean;
};

/** The global menu's tier chip, or none while billing is switched off. */
export function membershipMenuEntry(
  tier: BillingTier,
  billingEnabled: boolean
): MembershipMenuEntry | null {
  return billingEnabled ? { tier, highlighted: tier === 'paid' } : null;
}
