/**
 * What the billing screen shows, as a pure function of the caller's synced
 * membership row and the permission system's decisions. Billing reads its own
 * membership; it never learns whether the caller is signed in — a subscribe
 * denial arrives with its unlock label, whatever unlocks it. The screen
 * renders this and nothing else, so every combination is testable without a
 * DOM.
 */

import {
  rowGrantsMembership,
  rowMembershipLapsesAtMs,
} from '@libs/billing-shared-ts/governing-row';
import type { MembershipRow } from '@libs/billing-shared-ts/membership-row';
import type {
  OfferPriceSpec,
  PlusMembershipOffer,
} from '@pkgs/billing-root-shared-ts/offer';
import { paidAccessEndsAtMs } from '@pkgs/billing-root-shared-ts/precedence';

/** Whether the membership makes the account a member right now. */
export type BillingTier = 'free' | 'paid';

/** The membership as the person understands it. */
export type MembershipState =
  /** The device does not know yet where the membership stands. */
  | 'loading'
  | 'none'
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'canceling'
  | 'delinquent'
  | 'ended';

export type BillingPrimaryAction = 'subscribe' | 'unlock' | 'none';

export type BillingNotice =
  | 'unavailable'
  | 'delinquent'
  | 'incomplete'
  /** Subscribing is on offer, but the device cannot reach the server. */
  | 'offline'
  /** Back from paying at checkout; the new membership has not shown yet. */
  | 'confirming'
  /** Still no new membership a while after paying: check before paying again. */
  | 'unconfirmed';

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
  /** When the server last confirmed the row (`null`: never on record). */
  readonly confirmedAtMs: number | null;
  /** The device can reach the server right now. */
  readonly online: boolean;
  /** The row is not known yet (`row: null` does not mean "none"). */
  readonly loading: boolean;
  /** When the person came back from paying at checkout, or `null`. */
  readonly checkoutReturnedAtMs: number | null;
};

export type BillingView = {
  readonly tier: BillingTier;
  readonly state: MembershipState;
  /** Trial end, renewal or end — whichever `state` is about. */
  readonly periodEndMs: number | null;
  /**
   * The last instant of paid access a membership that will not renew leaves
   * (its period end plus grace), while it is still ahead; else `null`.
   */
  readonly accessEndsMs: number | null;
  /** Whole days until `periodEndMs` (never negative), when it is ahead. */
  readonly daysLeft: number | null;
  /** The offer price the membership is on, when known. */
  readonly priceKey: string | null;
  readonly primary: BillingPrimaryAction;
  /** Label of the `unlock` primary action. */
  readonly unlockLabel: string | null;
  readonly manage: boolean;
  /** Offer to look again for a membership a paid checkout should have made. */
  readonly checkAgain: boolean;
  readonly notice: BillingNotice | null;
  /** The offer's prices and benefits (hidden while billing is off). */
  readonly showPricing: boolean;
  /** Plus credit in cents. Never negative; `0` when there is none to show. */
  readonly creditCents: number;
};

const DAY_MS = 86_400_000;

/**
 * How long after coming back from paying the screen waits for the new
 * membership before saying it may still have gone through.
 */
export const CHECKOUT_CONFIRMING_MS = 2 * 60_000;

/** States whose membership no longer renews at its period end. */
const NOT_RENEWING: ReadonlySet<MembershipState> = new Set<MembershipState>([
  'canceling',
  'delinquent',
  'ended',
]);

/** States with no date to show, and with no plan to mark current. */
const NO_DATE: ReadonlySet<MembershipState> = new Set<MembershipState>([
  'loading',
  'none',
  'incomplete',
]);
const NO_PLAN: ReadonlySet<MembershipState> = new Set<MembershipState>([
  'loading',
  'none',
]);

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

/** Provider credit in cents, clamped so the screen never shows a debt. */
function creditCentsOf(row: MembershipRow | null): number {
  const raw = row?.credit_cents;
  if (raw === null || raw === undefined || raw === '') return 0;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

/** Where a paid checkout stands while its membership has not shown yet. */
type CheckoutReturn = 'confirming' | 'unconfirmed' | null;

function checkoutReturnOf(
  input: BillingViewInput,
  state: MembershipState
): CheckoutReturn {
  const returnedAt = input.checkoutReturnedAtMs;
  if (returnedAt === null || !input.canView || !input.canManage) return null;
  // Any membership newer than the checkout ends the wait; an older ended one
  // is what a returning member subscribes again from.
  if (state !== 'none' && state !== 'ended') return null;
  return input.nowMs < returnedAt + CHECKOUT_CONFIRMING_MS
    ? 'confirming'
    : 'unconfirmed';
}

function primaryOf(
  input: BillingViewInput,
  state: MembershipState,
  tier: BillingTier,
  checkout: CheckoutReturn
): BillingPrimaryAction {
  if (!input.canView || state === 'loading') return 'none';
  // Until a paid checkout's membership shows, a second one could charge twice.
  if (checkout === 'confirming') return 'none';
  // A live or delinquent member manages it in the portal; a second checkout
  // would start a second subscription. An ended membership can start again at
  // once, even while its grace still grants paid access.
  const open =
    state === 'ended' ||
    (tier === 'free' && (state === 'none' || state === 'incomplete'));
  if (!open) return 'none';
  if (input.canSubscribe) return 'subscribe';
  return input.subscribeUnlockLabel === null ? 'none' : 'unlock';
}

function noticeOf(
  input: BillingViewInput,
  state: MembershipState,
  primary: BillingPrimaryAction,
  checkout: CheckoutReturn
): BillingNotice | null {
  if (!input.canView) return 'unavailable';
  if (checkout === 'confirming') return 'confirming';
  // Checkout happens at the provider: offline, say so before the press.
  if (primary === 'subscribe' && !input.online) return 'offline';
  if (checkout === 'unconfirmed') return 'unconfirmed';
  if (state === 'delinquent') return 'delinquent';
  if (state === 'incomplete') return 'incomplete';
  return null;
}

function accessEndsOf(
  input: BillingViewInput,
  state: MembershipState,
  periodEndMs: number | null
): number | null {
  if (periodEndMs === null || !NOT_RENEWING.has(state)) return null;
  const endsMs = paidAccessEndsAtMs(periodEndMs, input.graceMs);
  return endsMs < input.nowMs ? null : endsMs;
}

/** When the paid checkout's wait turns into "check again", if still ahead. */
function confirmingEndsAtMs(input: BillingViewInput): number | null {
  if (input.checkoutReturnedAtMs === null) return null;
  const endsAt = input.checkoutReturnedAtMs + CHECKOUT_CONFIRMING_MS;
  return endsAt > input.nowMs ? endsAt : null;
}

/** When the view would change with only time passing, or `null`. */
export function billingViewChangesAtMs(input: BillingViewInput): number | null {
  const row = input.canManage ? input.row : null;
  const lapsesAt = rowMembershipLapsesAtMs(row, input);
  const confirmingEndsAt = confirmingEndsAtMs(input);
  if (lapsesAt === null) return confirmingEndsAt;
  if (confirmingEndsAt === null) return lapsesAt;
  return Math.min(lapsesAt, confirmingEndsAt);
}

export function buildBillingView(input: BillingViewInput): BillingView {
  // Membership details belong to whoever may manage billing; a row left on
  // the device says nothing about anyone else.
  const row = input.canManage ? input.row : null;
  // Until the row is known, "no membership" would be a guess — and offering
  // a checkout on it could start a second membership.
  const loading = input.canManage && input.loading && row === null;
  const state: MembershipState = loading ? 'loading' : membershipStateOf(row);
  const tier: BillingTier = rowGrantsMembership(row, input) ? 'paid' : 'free';
  const periodEndMs = NO_DATE.has(state) ? null : periodEndOf(row);
  const checkout = checkoutReturnOf(input, state);
  const primary = primaryOf(input, state, tier, checkout);
  return {
    tier,
    state,
    periodEndMs,
    accessEndsMs: accessEndsOf(input, state, periodEndMs),
    daysLeft:
      periodEndMs === null || periodEndMs < input.nowMs
        ? null
        : Math.ceil((periodEndMs - input.nowMs) / DAY_MS),
    priceKey: NO_PLAN.has(state) ? null : (row?.price_key ?? null),
    primary,
    unlockLabel: primary === 'unlock' ? input.subscribeUnlockLabel : null,
    manage: !loading && input.canView && input.canManage && input.hasCustomer,
    checkAgain: checkout === 'unconfirmed',
    notice: noticeOf(input, state, primary, checkout),
    showPricing: input.canView,
    creditCents: creditCentsOf(row),
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
