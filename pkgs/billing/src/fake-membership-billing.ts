import type {
  CallbackResult,
  MembershipBilling,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from './membership';

export type FakeMembershipBillingOptions = {
  /** Absolute base of the app's mock provider routes. */
  readonly mockBaseUrl: string;
};

/**
 * Reference implementation of {@link MembershipBilling}: stateless, and its
 * checkout/portal URLs point at this app's own dev-only mock routes.
 *
 * No provider state means every instance agrees — safe for the localhost
 * stack's N API nodes without coordination. The mock routes apply membership
 * changes directly, so there are no signed callbacks to read.
 */
export class FakeMembershipBilling implements MembershipBilling {
  constructor(private readonly options: FakeMembershipBillingOptions) {}

  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const customerId = input.customerId ?? `fake_cus_${input.accountId}`;
    const query = new URLSearchParams({
      accountId: input.accountId,
      returnUrl: input.returnUrl,
    });
    return Promise.resolve({
      customerId,
      url: `${this.options.mockBaseUrl}/checkout?${query.toString()}`,
    });
  }

  openPortal(input: OpenPortalInput): Promise<{ readonly url: string }> {
    const query = new URLSearchParams({
      accountId: input.accountId,
      returnUrl: input.returnUrl,
    });
    return Promise.resolve({
      url: `${this.options.mockBaseUrl}/portal?${query.toString()}`,
    });
  }

  readCallback(_input: ReadCallbackInput): Promise<CallbackResult> {
    // The fake has no signed callbacks; the mock routes apply changes directly.
    return Promise.resolve({ kind: 'unverified' });
  }
}
