// goal:room-to-grow:4
import { describe, expect, it } from 'bun:test';
import { FakeMembershipBilling } from './fake-membership-billing';
import type {
  CallbackResult,
  MembershipBilling,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from './membership';

const mockBaseUrl = 'https://api.test/api/billing/mock';
const billing: MembershipBilling = new FakeMembershipBilling({ mockBaseUrl });

describe('FakeMembershipBilling satisfies the port', () => {
  it('mints an absolute checkout url at the mock base and a fresh customer', async () => {
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      returnUrl: 'https://app.test/more/billing',
    });
    expect(result.customerId).toBe('fake_cus_acct-1');
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(`${mockBaseUrl}/checkout`);
    expect(url.searchParams.get('accountId')).toBe('acct-1');
    expect(url.searchParams.get('returnUrl')).toBe(
      'https://app.test/more/billing'
    );
  });

  it('echoes a customer already linked to the account', async () => {
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: 'fake_cus_existing',
      returnUrl: 'https://app.test/more/billing',
    });
    expect(result.customerId).toBe('fake_cus_existing');
  });

  it('opens a portal url at the mock base', async () => {
    const result = await billing.openPortal({
      accountId: 'acct-1',
      customerId: 'fake_cus_acct-1',
      returnUrl: 'https://app.test/more/billing',
    });
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(`${mockBaseUrl}/portal`);
  });

  it('reports callbacks as unverified (no signature scheme)', async () => {
    const result = await billing.readCallback({
      headers: new Headers(),
      rawBody: '{}',
    });
    expect(result.kind).toBe('unverified');
  });
});

describe('the port admits another payment provider', () => {
  /** Minimal second implementation: same port, different vendor identity. */
  class OtherProviderBilling implements MembershipBilling {
    private readonly seen: string[] = [];

    startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
      this.seen.push(input.accountId);
      return Promise.resolve({
        customerId: input.customerId ?? `other_cus_${input.accountId}`,
        url: 'https://other.test/checkout',
      });
    }

    openPortal(_input: OpenPortalInput): Promise<{ readonly url: string }> {
      return Promise.resolve({ url: 'https://other.test/portal' });
    }

    readCallback(_input: ReadCallbackInput): Promise<CallbackResult> {
      return Promise.resolve({
        kind: 'membership',
        provider: 'other',
        customerId: 'other_cus_acct-1',
        subscriptionId: 'other_sub',
        offerPriceKey: 'subscription_monthly',
        membership: {
          status: 'active',
          periodEndMs: 1_700_000_000_000,
          endsAtPeriodEnd: false,
        },
      });
    }

    customersSeen(): readonly string[] {
      return this.seen;
    }
  }

  it('runs the same flow with limits untouched', async () => {
    const other: MembershipBilling = new OtherProviderBilling();
    const checkout = await other.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      returnUrl: 'https://app.test/ok',
    });
    expect(checkout.url).toBe('https://other.test/checkout');
    const callback = await other.readCallback({
      headers: new Headers(),
      rawBody: '{}',
    });
    expect(callback.kind).toBe('membership');
    if (callback.kind !== 'membership') throw new Error('unreachable');
    expect(callback.membership.status).toBe('active');
  });
});
