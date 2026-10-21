/**
 * The membership port's contract, as a test suite every implementation runs.
 *
 * Every provider — Stripe, Paddle, the mock — is the same kind of thing to the app: an
 * adapter it hands a checkout, a portal and a callback to. This suite is how
 * that stays true — each adapter package calls
 * {@link describeMembershipBillingContract} with a harness over its own
 * provider's wire, and the assertions are identical for all of them.
 */
import { describe, expect, test } from 'bun:test';
import type { ContractSituation } from './contract-fixtures';
import {
  CONTRACT_EXPECTED,
  CONTRACT_OFFER,
  CONTRACT_PERIOD_END_MS,
  CONTRACT_SITUATIONS,
} from './contract-fixtures';
import type {
  MembershipBilling,
  ReadCallbackInput,
  StartCheckoutResult,
} from './membership';
import { isMembershipProviderId } from './providers';

/** One subscription as the harness's provider will report it. */
export type ContractSubscription = {
  readonly id: string;
  readonly customerId: string;
  /** An offer price key, or `null` for a price outside the offer. */
  readonly priceKey: string | null;
  readonly situation: ContractSituation;
};

/** How the harness signs a callback. */
export type ContractSignature =
  | 'valid'
  | 'missing'
  | 'wrong_secret'
  | 'tampered'
  | 'stale';

export type ContractCallbackKind =
  | 'subscription_changed'
  | 'subscription_ended'
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'unrelated';

/** A provider, as far as the contract needs to drive one. */
export type MembershipBillingContractHarness = {
  /** The adapter under test, configured with {@link CONTRACT_OFFER}. */
  readonly billing: MembershipBilling;
  /** Make the provider's API report `subscription` from now on. */
  setSubscription(subscription: ContractSubscription): void;
  /**
   * Make every provider API call fail with a server error (`true`) or answer
   * again (`false`) — an outage, not a missing object.
   */
  setUnavailable(unavailable: boolean): void;
  /**
   * The callback the provider would deliver about subscription `id` right
   * now, carrying a snapshot of its current state.
   */
  callback(args: {
    readonly subscriptionId: string;
    readonly kind: ContractCallbackKind;
    readonly signature: ContractSignature;
  }): Promise<ReadCallbackInput>;
};

const RETURN_URL = 'https://app.test/more/billing';

function checkoutInput(accountId: string, customerId: string | null) {
  return {
    accountId,
    customerId,
    email: `${accountId}@people.test`,
    returnUrl: RETURN_URL,
  };
}

function assertAbsoluteUrl(url: string): void {
  expect(url.length).toBeGreaterThan(0);
  expect(['http:', 'https:']).toContain(new URL(url).protocol);
}

async function changeOf(
  harness: MembershipBillingContractHarness,
  subscription: ContractSubscription,
  kind: ContractCallbackKind = 'subscription_changed'
) {
  harness.setSubscription(subscription);
  const result = await harness.billing.readCallback(
    await harness.callback({
      subscriptionId: subscription.id,
      kind,
      signature: 'valid',
    })
  );
  if (result.kind !== 'membership') {
    throw new Error(`expected a membership change, got ${result.kind}`);
  }
  return result;
}

/** The checkout a start opened (or handed back); fails on any other answer. */
function opened(result: StartCheckoutResult) {
  if (result.kind !== 'checkout') {
    throw new Error(`expected a checkout, got ${result.kind}`);
  }
  return result;
}

function describeSessions(
  open: () => Promise<MembershipBillingContractHarness>
): void {
  test('the provider id is a lowercase slug', async () => {
    const { billing } = await open();
    expect(isMembershipProviderId(billing.provider)).toBe(true);
  });

  test('checkout mints a customer when the account has none', async () => {
    const { billing } = await open();
    const result = opened(
      await billing.startCheckout(checkoutInput('acct-1', null))
    );
    expect(result.customerId.length).toBeGreaterThan(0);
    assertAbsoluteUrl(result.url);
  });

  test('checkout keeps the customer already linked to the account', async () => {
    const { billing } = await open();
    const first = await billing.startCheckout(checkoutInput('acct-1', null));
    const again = await billing.startCheckout(
      checkoutInput('acct-1', first.customerId)
    );
    expect(again.customerId).toBe(first.customerId);
  });

  test('different accounts get different customers', async () => {
    const { billing } = await open();
    const a = await billing.startCheckout(checkoutInput('acct-a', null));
    const b = await billing.startCheckout(checkoutInput('acct-b', null));
    expect(a.customerId).not.toBe(b.customerId);
  });

  test('the portal opens for a linked customer', async () => {
    const { billing } = await open();
    const checkout = await billing.startCheckout(checkoutInput('acct-1', null));
    const portal = await billing.openPortal({
      accountId: 'acct-1',
      customerId: checkout.customerId,
      returnUrl: RETURN_URL,
    });
    assertAbsoluteUrl(portal.url);
  });
}

/** A customer has at most one checkout that can take a payment. */
function describeOneCheckout(
  open: () => Promise<MembershipBillingContractHarness>
): void {
  test('checkout again while one is open hands back that checkout', async () => {
    const { billing } = await open();
    const first = opened(
      await billing.startCheckout(checkoutInput('acct-1', null))
    );
    const again = opened(
      await billing.startCheckout(checkoutInput('acct-1', first.customerId))
    );
    expect(again.url).toBe(first.url);
  });

  test('checkout for a customer with a live membership opens none', async () => {
    const harness = await open();
    const first = await harness.billing.startCheckout(
      checkoutInput('acct-1', null)
    );
    harness.setSubscription({
      ...SUBSCRIPTION,
      id: 'sub_paid_unconfirmed',
      customerId: first.customerId,
      situation: 'trialing',
    });
    const again = await harness.billing.startCheckout(
      checkoutInput('acct-1', first.customerId)
    );
    expect(again).toEqual({
      kind: 'live_membership',
      customerId: first.customerId,
    });
  });

  test('an ended membership does not stop a new checkout', async () => {
    const harness = await open();
    const first = await harness.billing.startCheckout(
      checkoutInput('acct-1', null)
    );
    harness.setSubscription({
      ...SUBSCRIPTION,
      id: 'sub_ended',
      customerId: first.customerId,
      situation: 'canceled_immediately',
    });
    const again = opened(
      await harness.billing.startCheckout(
        checkoutInput('acct-1', first.customerId)
      )
    );
    assertAbsoluteUrl(again.url);
  });
}

const SUBSCRIPTION: ContractSubscription = {
  id: 'sub_contract',
  customerId: 'cus_contract',
  priceKey: 'subscription_monthly',
  situation: 'active',
};

function describeAuthenticity(
  open: () => Promise<MembershipBillingContractHarness>
): void {
  const rejected: readonly ContractSignature[] = [
    'missing',
    'wrong_secret',
    'tampered',
    'stale',
  ];
  for (const signature of rejected) {
    test(`a ${signature} signature is unverified`, async () => {
      const harness = await open();
      harness.setSubscription(SUBSCRIPTION);
      const result = await harness.billing.readCallback(
        await harness.callback({
          subscriptionId: SUBSCRIPTION.id,
          kind: 'subscription_changed',
          signature,
        })
      );
      expect(result.kind).toBe('unverified');
    });
  }

  test('an event about something else is ignored', async () => {
    const harness = await open();
    harness.setSubscription(SUBSCRIPTION);
    const result = await harness.billing.readCallback(
      await harness.callback({
        subscriptionId: SUBSCRIPTION.id,
        kind: 'unrelated',
        signature: 'valid',
      })
    );
    expect(result.kind).toBe('ignored');
  });
}

function describeProjection(
  open: () => Promise<MembershipBillingContractHarness>,
  unreachable: ContractUnreachable
): void {
  for (const situation of CONTRACT_SITUATIONS) {
    const reason = unreachable[situation];
    if (reason !== undefined) {
      // Declared by name, with a reason, rather than silently left out.
      test(`${situation} cannot arise: ${reason}`, () => {
        expect(reason.trim().length).toBeGreaterThan(0);
      });
      continue;
    }
    test(`${situation} reports ${CONTRACT_EXPECTED[situation].status}`, async () => {
      const harness = await open();
      const change = await changeOf(harness, { ...SUBSCRIPTION, situation });
      expect(change.provider).toBe(harness.billing.provider);
      expect(change.customerId).toBe(SUBSCRIPTION.customerId);
      expect(change.subscriptionId).toBe(SUBSCRIPTION.id);
      expect(change.offerPriceKey).toBe('subscription_monthly');
      expect(change.membership).toEqual(CONTRACT_EXPECTED[situation]);
    });
  }

  test('a paused-subscription callback reports it ended', async () => {
    const harness = await open();
    const change = await changeOf(
      harness,
      { ...SUBSCRIPTION, situation: 'paused' },
      'subscription_paused'
    );
    expect(change.membership).toEqual(CONTRACT_EXPECTED.paused);
  });

  test('a resumed-subscription callback reports it live', async () => {
    const harness = await open();
    const change = await changeOf(
      harness,
      { ...SUBSCRIPTION, situation: 'active' },
      'subscription_resumed'
    );
    expect(change.membership).toEqual(CONTRACT_EXPECTED.active);
  });

  test('an ended-subscription callback reports it ended', async () => {
    const harness = await open();
    const change = await changeOf(
      harness,
      { ...SUBSCRIPTION, situation: 'canceled_immediately' },
      'subscription_ended'
    );
    expect(change.membership).toEqual(CONTRACT_EXPECTED.canceled_immediately);
  });

  test('a switched price reports its offer key', async () => {
    const harness = await open();
    const change = await changeOf(harness, {
      ...SUBSCRIPTION,
      priceKey: 'subscription_yearly',
    });
    expect(change.offerPriceKey).toBe('subscription_yearly');
  });

  test('a price outside the offer reports no key', async () => {
    const harness = await open();
    const change = await changeOf(harness, { ...SUBSCRIPTION, priceKey: null });
    expect(change.offerPriceKey).toBeNull();
  });
}

function describeDelivery(
  open: () => Promise<MembershipBillingContractHarness>
): void {
  test('a late, stale delivery reports the current state', async () => {
    const harness = await open();
    harness.setSubscription({ ...SUBSCRIPTION, situation: 'trialing' });
    const stale = await harness.callback({
      subscriptionId: SUBSCRIPTION.id,
      kind: 'subscription_changed',
      signature: 'valid',
    });
    harness.setSubscription({
      ...SUBSCRIPTION,
      situation: 'canceled_immediately',
    });
    const result = await harness.billing.readCallback(stale);
    if (result.kind !== 'membership') throw new Error(result.kind);
    expect(result.membership).toEqual(CONTRACT_EXPECTED.canceled_immediately);
  });

  test('an ended callback is final even when a re-read still reads live', async () => {
    // Deletion is terminal at every provider; a read that disagrees lags.
    // Failing closed ends access rather than trusting it.
    const harness = await open();
    const change = await changeOf(
      harness,
      { ...SUBSCRIPTION, situation: 'active' },
      'subscription_ended'
    );
    expect(change.membership).toEqual({
      status: 'ended',
      periodEndMs: CONTRACT_PERIOD_END_MS,
      endsAtPeriodEnd: false,
    });
  });

  test('a callback about a subscription the provider does not know is ignored', async () => {
    const harness = await open();
    const result = await harness.billing.readCallback(
      await harness.callback({
        subscriptionId: 'sub_unknown',
        kind: 'subscription_changed',
        signature: 'valid',
      })
    );
    expect(result.kind).toBe('ignored');
  });

  test('an unreachable provider throws, so the delivery is retried', async () => {
    const harness = await open();
    harness.setSubscription(SUBSCRIPTION);
    const callback = await harness.callback({
      subscriptionId: SUBSCRIPTION.id,
      kind: 'subscription_changed',
      signature: 'valid',
    });
    harness.setUnavailable(true);
    await expect(harness.billing.readCallback(callback)).rejects.toThrow();
    harness.setUnavailable(false);
    const retried = await harness.billing.readCallback(callback);
    expect(retried.kind).toBe('membership');
  });

  test('a duplicate delivery reports the same change', async () => {
    const harness = await open();
    harness.setSubscription(SUBSCRIPTION);
    const callback = await harness.callback({
      subscriptionId: SUBSCRIPTION.id,
      kind: 'subscription_changed',
      signature: 'valid',
    });
    const first = await harness.billing.readCallback(callback);
    const second = await harness.billing.readCallback(callback);
    expect(second).toEqual(first);
  });
}

/**
 * Situations a provider's object model cannot express, each with the reason
 * (Paddle creates a subscription only once its first payment settles, so it
 * never holds an incomplete one). Every situation not named here must map.
 */
export type ContractUnreachable = Readonly<
  Partial<Record<ContractSituation, string>>
>;

/**
 * Registers the whole contract for one implementation. `open` builds a fresh
 * harness (and provider state) per test, with its adapter configured with
 * {@link CONTRACT_OFFER} and its clock at {@link CONTRACT_NOW_MS}.
 */
export function describeMembershipBillingContract(
  name: string,
  open: () => Promise<MembershipBillingContractHarness>,
  options: { readonly unreachable?: ContractUnreachable } = {}
): void {
  describe(`${name} satisfies the membership contract`, () => {
    describe('sessions', () => describeSessions(open));
    describe('one checkout at a time', () => describeOneCheckout(open));
    describe('authenticity', () => describeAuthenticity(open));
    describe('projection', () =>
      describeProjection(open, options.unreachable ?? {}));
    describe('delivery', () => describeDelivery(open));
  });
}
