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
  /** End of the paid period the provider last confirmed (epoch ms). */
  readonly periodEndMs: number | null;
  /** True while the provider will stop at `periodEndMs`. */
  readonly endsAtPeriodEnd: boolean;
  readonly status: MembershipStatus;
};

export type MembershipChange = {
  /** The adapter's own identity, stored on the projection row. */
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
  /** The provider customer already linked to this account, if any. */
  readonly customerId: string | null;
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
 */
export interface MembershipBilling {
  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult>;
  openPortal(input: OpenPortalInput): Promise<{ readonly url: string }>;
  /** Verifies authenticity itself; the caller never sees a signature scheme. */
  readCallback(input: ReadCallbackInput): Promise<CallbackResult>;
}
