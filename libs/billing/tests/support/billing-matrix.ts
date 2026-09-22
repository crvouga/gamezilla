/** The billing screen's input space, shared by the view-model and DOM tests. */
import type {
  BillingTier,
  BillingViewInput,
  MembershipRow,
} from '@libs/billing/root/client/billing-view-model';

export const NOW = Date.parse('2026-09-21T12:00:00.000Z');
export const DAY = 86_400_000;
export const PERIOD_END = new Date(NOW + 10 * DAY).toISOString();
export const PAST_END = new Date(NOW - 3 * DAY).toISOString();

export const TIERS: readonly BillingTier[] = ['guest', 'free', 'paid'];

/** Every membership row the screen distinguishes, by name. */
export const ROW_KINDS = {
  none: null,
  incomplete: row('incomplete'),
  trialing: row('trialing'),
  active: row('active'),
  canceling: row('active', true),
  delinquent: row('delinquent'),
  ended: row('ended', false, PAST_END),
} as const satisfies Record<string, MembershipRow | null>;

export type RowKind = keyof typeof ROW_KINDS;

export function row(
  status: string,
  cancel = false,
  end: string = PERIOD_END
): MembershipRow {
  return {
    status,
    price_key: 'subscription_monthly',
    current_period_end: end,
    cancel_at_period_end: cancel ? 1 : 0,
  };
}

/** The shipped policy: free may subscribe, any account may manage. */
export function inputFor(
  tier: BillingTier,
  kind: RowKind,
  billingEnabled: boolean,
  hasCustomer: boolean
): BillingViewInput {
  return {
    tier,
    billingEnabled,
    canSubscribe: tier === 'free',
    canManage: tier !== 'guest',
    hasCustomer,
    row: ROW_KINDS[kind],
    nowMs: NOW,
  };
}
