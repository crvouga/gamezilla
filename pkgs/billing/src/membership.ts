/**
 * Our status vocabulary for a plus membership. Every adapter maps its
 * provider's states onto exactly these; nothing downstream sees a vendor state.
 */
export type MembershipStatus =
  | 'incomplete' // checkout started, first payment not settled
  | 'trialing' // inside a trial period
  | 'active' // paid and current
  | 'delinquent' // payment failed; access runs to the period end
  | 'ended'; // no further access (canceled, expired, never paid)

export type Membership = {
  /**
   * When access runs out (epoch ms): the end of the paid period the provider
   * last confirmed, or — for an `ended` membership — the moment it ended, when
   * that came before the period end (an immediate cancellation). Never a
   * period the person no longer has: an `ended` membership whose last
   * payment was refunded has none (`null`), so it keeps no access at all —
   * the grace after a period end is for time that was paid for.
   */
  readonly periodEndMs: number | null;
  /** True while the provider will stop at `periodEndMs`. */
  readonly endsAtPeriodEnd: boolean;
  readonly status: MembershipStatus;
};

export type MembershipChange = {
  /**
   * The adapter's own identity ({@link MembershipBilling.provider}), stored on
   * the projection row.
   */
  readonly provider: string;
  /** The provider customer the change is about. */
  readonly customerId: string;
  /** The provider subscription identity (stable projection key). */
  readonly subscriptionId: string;
  /** Which of our offer's prices is charged, or `null` when unknown. */
  readonly offerPriceKey: string | null;
  readonly membership: Membership;
};

export type StartCheckoutInput = {
  readonly accountId: string;
  /**
   * The provider customer already linked to this account *at this provider*,
   * if any. Customers never cross providers.
   */
  readonly customerId: string | null;
  /**
   * The account's email, when the app knows it. Some providers cannot mint a
   * customer without one (Paddle); those refuse a checkout that has none.
   */
  readonly email: string | null;
  readonly returnUrl: string;
};

export type StartCheckoutResult = {
  /** The provider customer to remember for this account. */
  readonly customerId: string;
  /** Where to send the person; non-empty on success. */
  readonly url: string;
};

export type OpenPortalInput = {
  readonly accountId: string;
  readonly customerId: string;
  readonly returnUrl: string;
};

export type ReadCallbackInput = {
  readonly headers: Headers;
  readonly rawBody: string;
};

export type CallbackResult =
  | { readonly kind: 'unverified' }
  | { readonly kind: 'ignored' }
  | ({ readonly kind: 'membership' } & MembershipChange);

/**
 * What the app needs from a payment provider: start a plus membership, let the
 * person manage it, and learn what changed. Nothing else belongs here.
 *
 * Every implementation — Stripe, Paddle, the mock provider — must pass
 * `describeMembershipBillingContract` (`./membership-billing-contract`); the
 * app treats them identically and never branches on which one it holds. It
 * may hold several at once ({@link MembershipProviders}).
 */
export interface MembershipBilling {
  /**
   * The adapter's identity: a lowercase slug (`stripe`, `paddle`, `mock`)
   * that is stable forever, because it keys stored data — the projection
   * row, the account's customer link and the callback path. The app treats
   * it as an opaque key and never compares it to a vendor name.
   */
  readonly provider: string;
  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult>;
  openPortal(input: OpenPortalInput): Promise<{ readonly url: string }>;
  /**
   * Verifies authenticity itself; the caller never sees a signature scheme.
   * A verified callback reports the provider's *current* state of the
   * subscription it names, not the payload's snapshot: providers deliver
   * duplicates and out of order, so an adapter re-reads before it answers.
   * The one exception is a callback saying the subscription ended, which is
   * final: it reports `ended` even when the re-read lags. A subscription the
   * provider does not know is `ignored`. Throws when the provider cannot be
   * reached, so the delivery is retried.
   */
  readCallback(input: ReadCallbackInput): Promise<CallbackResult>;
}
