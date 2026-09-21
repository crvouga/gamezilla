/**
 * The membership port's contract, as a test suite every implementation runs.
 *
 * Stripe and the mock provider are the same kind of thing to the app: an
 * adapter it hands a checkout, a portal and a callback to. This suite is how
 * that stays true — each adapter package calls
 * {@link describeMembershipBillingContract} with a harness over its own
 * provider's wire, and the assertions are identical for all of them.
 */
import { describe, expect, test } from 'bun:test';

import {
  CONTRACT_EXPECTED,
  CONTRACT_OFFER,
  CONTRACT_SITUATIONS,
  type ContractSituation,
} from './contract-fixtures';
import type { MembershipBilling, ReadCallbackInput } from './membership';

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
  | 'unrelated';

/** A provider, as far as the contract needs to drive one. */
export type MembershipBillingContractHarness = {
  /** The identity the adapter stamps on every change. */
  readonly provider: string;
  /** The adapter under test, configured with {@link CONTRACT_OFFER}. */
  readonly billing: MembershipBilling;
  /** Make the provider's API report `subscription` from now on. */
  setSubscription(subscription: ContractSubscription): void;
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

function describeSessions(
  open: () => Promise<MembershipBillingContractHarness>
): void {
  test('checkout mints a customer when the account has none', async () => {
    const { billing } = await open();
    const result = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      returnUrl: RETURN_URL,
    });
    expect(result.customerId.length).toBeGreaterThan(0);
    assertAbsoluteUrl(result.url);
  });

  test('checkout keeps the customer already linked to the account', async () => {
    const { billing } = await open();
    const first = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      returnUrl: RETURN_URL,
    });
    const again = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: first.customerId,
      returnUrl: RETURN_URL,
    });
    expect(again.customerId).toBe(first.customerId);
  });

  test('different accounts get different customers', async () => {
    const { billing } = await open();
    const a = await billing.startCheckout({
      accountId: 'acct-a',
      customerId: null,
      returnUrl: RETURN_URL,
    });
    const b = await billing.startCheckout({
      accountId: 'acct-b',
      customerId: null,
      returnUrl: RETURN_URL,
    });
    expect(a.customerId).not.toBe(b.customerId);
  });

  test('the portal opens for a linked customer', async () => {
    const { billing } = await open();
    const checkout = await billing.startCheckout({
      accountId: 'acct-1',
      customerId: null,
      returnUrl: RETURN_URL,
    });
    const portal = await billing.openPortal({
      accountId: 'acct-1',
      customerId: checkout.customerId,
      returnUrl: RETURN_URL,
    });
    assertAbsoluteUrl(portal.url);
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
  open: () => Promise<MembershipBillingContractHarness>
): void {
  for (const situation of CONTRACT_SITUATIONS) {
    test(`${situation} reports ${CONTRACT_EXPECTED[situation].status}`, async () => {
      const harness = await open();
      const change = await changeOf(harness, { ...SUBSCRIPTION, situation });
      expect(change.provider).toBe(harness.provider);
      expect(change.customerId).toBe(SUBSCRIPTION.customerId);
      expect(change.subscriptionId).toBe(SUBSCRIPTION.id);
      expect(change.offerPriceKey).toBe('subscription_monthly');
      expect(change.membership).toEqual(CONTRACT_EXPECTED[situation]);
    });
  }

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
 * Registers the whole contract for one implementation. `open` builds a fresh
 * harness (and provider state) per test, with its adapter configured with
 * {@link CONTRACT_OFFER} and its clock at {@link CONTRACT_NOW_MS}.
 */
export function describeMembershipBillingContract(
  name: string,
  open: () => Promise<MembershipBillingContractHarness>
): void {
  describe(`${name} satisfies the membership contract`, () => {
    describe('sessions', () => describeSessions(open));
    describe('authenticity', () => describeAuthenticity(open));
    describe('projection', () => describeProjection(open));
    describe('delivery', () => describeDelivery(open));
  });
}

export {
  CONTRACT_ENDED_AT_MS,
  CONTRACT_EXPECTED,
  CONTRACT_NOW_MS,
  CONTRACT_OFFER,
  CONTRACT_PERIOD_END_MS,
  CONTRACT_SITUATIONS,
  type ContractSituation,
} from './contract-fixtures';
