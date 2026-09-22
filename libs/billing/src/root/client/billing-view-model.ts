/**
 * What the billing screen shows, as a pure function of the caller's synced
 * membership row and the permission system's decisions. Billing reads its own
 * membership; it never learns whether the caller is signed in — a subscribe
 * denial arrives with its unlock label, whatever unlocks it. The screen
 * renders this and nothing else, so every combination is testable without a
 * DOM.
 */
import type { OfferPriceSpec, PlusMembershipOffer } from '@pkgs/billing';

import { rowGrantsMembership } from '../../shared/memberships/governing-row';
import type { MembershipRow } from '../../use-cases/load-my-subscription/shared/membership-row';

export type { MembershipRow };

/** Whether the membership makes the account a member right now. */
export type BillingTier = 'free' | 'paid';

/** The membership as the person understands it. */
export type MembershipState =
  | 'none'
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'canceling'
  | 'delinquent'
  | 'ended';

export type BillingPrimaryAction = 'subscribe' | 'unlock' | 'none';

export type BillingNotice = 'unavailable' | 'delinquent' | 'incomplete';

export type BillingViewInput = {
  /** The live policy grants `billing:view` (denied while billing is off). */
  readonly canView: boolean;
  /** The live policy grants `billing:subscribe` / `billing:manage`. */
  readonly canSubscribe: boolean;
  readonly canManage: boolean;
  /** CTA label of the subscribe denial's unlock, when it has one. */
  readonly subscribeUnlockLabel: string | null;
  /** The account already has a provider customer (it can open the portal). */
  readonly hasCustomer: boolean;
  readonly row: MembershipRow | null;
  readonly nowMs: number;
  readonly graceMs: number;
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
  /** Label of the `unlock` primary action. */
  readonly unlockLabel: string | null;
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
  state: MembershipState,
  tier: BillingTier
): BillingPrimaryAction {
  if (!input.canView || tier === 'paid') return 'none';
  // A delinquent member fixes their card in the portal; a second checkout
  // would start a second subscription.
  const open = state === 'none' || state === 'incomplete' || state === 'ended';
  if (!open) return 'none';
  if (input.canSubscribe) return 'subscribe';
  return input.subscribeUnlockLabel === null ? 'none' : 'unlock';
}

function noticeOf(
  input: BillingViewInput,
  state: MembershipState
): BillingNotice | null {
  if (!input.canView) return 'unavailable';
  if (state === 'delinquent') return 'delinquent';
  if (state === 'incomplete') return 'incomplete';
  return null;
}

export function buildBillingView(input: BillingViewInput): BillingView {
  // Membership details belong to whoever may manage billing; a row left on
  // the device says nothing about anyone else.
  const row = input.canManage ? input.row : null;
  const state = membershipStateOf(row);
  const tier: BillingTier = rowGrantsMembership(row, input) ? 'paid' : 'free';
  const periodEndMs =
    state === 'none' || state === 'incomplete' ? null : periodEndOf(row);
  const primary = primaryOf(input, state, tier);
  return {
    tier,
    state,
    periodEndMs,
    daysLeft:
      periodEndMs === null || periodEndMs < input.nowMs
        ? null
        : Math.ceil((periodEndMs - input.nowMs) / DAY_MS),
    priceKey: state === 'none' ? null : (row?.price_key ?? null),
    primary,
    unlockLabel: primary === 'unlock' ? input.subscribeUnlockLabel : null,
    manage: input.canView && input.canManage && input.hasCustomer,
    notice: noticeOf(input, state),
    showPricing: input.canView,
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
