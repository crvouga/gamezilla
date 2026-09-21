/**
 * The mock provider's adapter for the membership port — the counterpart of
 * `StripeMembershipBilling`, built the same way: it reaches its provider only
 * over HTTP with a secret key, and learns what changed only from signed
 * webhooks. The app cannot tell which of the two it holds.
 */
import type {
  CallbackResult,
  Membership,
  MembershipBilling,
  MembershipChange,
  OpenPortalInput,
  PlusMembershipOffer,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing';

import { MockBillingApiError } from './api-error';
import { membershipStatusOf } from './membership-status';
import { verifyMockBillingSignature } from './signature';
import {
  type CreateCheckoutSessionBody,
  type CreatePortalSessionBody,
  MOCK_BILLING_PATHS,
  MOCK_BILLING_PROVIDER,
  MOCK_BILLING_SIGNATURE_HEADER,
  type MockCheckoutSession,
  type MockCustomer,
  type MockErrorBody,
  type MockEvent,
  type MockEventType,
  type MockList,
  type MockPortalSession,
  type MockPrice,
  type MockSubscription,
} from './wire';

export type MockBillingFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type MockMembershipBillingOptions = {
  /** The provider's origin (`http://billing.sim`, a loopback port, …). */
  readonly origin: string;
  readonly secretKey: string;
  /** Without it callbacks fail closed while checkout/portal keep working. */
  readonly webhookSecret: string | null;
  readonly offer: PlusMembershipOffer;
  readonly now: () => number;
  readonly fetch: MockBillingFetch;
};

/** The subscription events whose state we project. */
const MEMBERSHIP_EVENTS: ReadonlySet<MockEventType> = new Set<MockEventType>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

function accessEndMs(subscription: MockSubscription): number | null {
  const item = subscription.items.data[0];
  const periodEndMs =
    item === undefined ? null : item.current_period_end * 1000;
  if (membershipStatusOf(subscription.status) !== 'ended') return periodEndMs;
  if (subscription.ended_at === null) return periodEndMs;
  const endedAtMs = subscription.ended_at * 1000;
  return periodEndMs === null ? endedAtMs : Math.min(periodEndMs, endedAtMs);
}

function toMembership(subscription: MockSubscription): Membership {
  const status = membershipStatusOf(subscription.status);
  return {
    status,
    periodEndMs: accessEndMs(subscription),
    endsAtPeriodEnd: status !== 'ended' && subscription.cancel_at_period_end,
  };
}

export class MockMembershipBilling implements MembershipBilling {
  constructor(private readonly options: MockMembershipBillingOptions) {}

  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await this.options.fetch(
      new URL(path, this.options.origin).toString(),
      {
        method,
        headers: {
          authorization: `Bearer ${this.options.secretKey}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new MockBillingApiError(
        response.status,
        payload as MockErrorBody | null
      );
    }
    return payload as T;
  }

  private async priceFor(lookupKey: string): Promise<MockPrice> {
    const query = new URLSearchParams({
      lookup_keys: lookupKey,
      active: 'true',
    });
    const prices = await this.call<MockList<MockPrice>>(
      'GET',
      `${MOCK_BILLING_PATHS.prices}?${query.toString()}`
    );
    const price = prices.data[0];
    if (price === undefined) {
      throw new Error(
        `mock billing: no active price for lookup key ${lookupKey}`
      );
    }
    return price;
  }

  async startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const customer =
      input.customerId ??
      (
        await this.call<MockCustomer>('POST', MOCK_BILLING_PATHS.customers, {
          metadata: { accountId: input.accountId },
        })
      ).id;
    const { offer } = this.options;
    const spec = offer.prices[offer.defaultPriceKey];
    if (spec === undefined) {
      throw new Error(
        `mock billing: no offer price for key ${offer.defaultPriceKey}`
      );
    }
    const price = await this.priceFor(spec.lookupKey);
    const body: CreateCheckoutSessionBody = {
      mode: 'subscription',
      customer,
      client_reference_id: input.accountId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
      subscription_data: {
        metadata: { accountId: input.accountId },
        ...((spec.trialPeriodDays ?? 0) > 0
          ? { trial_period_days: spec.trialPeriodDays }
          : {}),
      },
    };
    const session = await this.call<MockCheckoutSession>(
      'POST',
      MOCK_BILLING_PATHS.checkoutSessions,
      body
    );
    return { customerId: customer, url: session.url ?? '' };
  }

  async openPortal(input: OpenPortalInput): Promise<{ readonly url: string }> {
    const body: CreatePortalSessionBody = {
      customer: input.customerId,
      return_url: input.returnUrl,
    };
    const session = await this.call<MockPortalSession>(
      'POST',
      MOCK_BILLING_PATHS.portalSessions,
      body
    );
    return { url: session.url };
  }

  private verified(input: ReadCallbackInput): MockEvent | null {
    const secret = this.options.webhookSecret;
    const header = input.headers.get(MOCK_BILLING_SIGNATURE_HEADER);
    if (secret === null || header === null) return null;
    const ok = verifyMockBillingSignature({
      secret,
      payload: input.rawBody,
      header,
      nowMs: this.options.now(),
    });
    if (!ok) return null;
    try {
      return JSON.parse(input.rawBody) as MockEvent;
    } catch {
      return null;
    }
  }

  private offerPriceKey(subscription: MockSubscription): string | null {
    const lookupKey = subscription.items.data[0]?.price.lookup_key ?? null;
    if (lookupKey === null) return null;
    const match = Object.values(this.options.offer.prices).find(
      (spec) => spec.lookupKey === lookupKey
    );
    return match?.key ?? null;
  }

  async readCallback(input: ReadCallbackInput): Promise<CallbackResult> {
    const event = this.verified(input);
    if (event === null) return { kind: 'unverified' };
    if (!MEMBERSHIP_EVENTS.has(event.type)) return { kind: 'ignored' };
    const id = event.data.object.id;
    // Deliveries repeat and arrive out of order; re-read the current state.
    const subscription = await this.call<MockSubscription>(
      'GET',
      MOCK_BILLING_PATHS.subscription(id)
    );
    const change: MembershipChange = {
      provider: MOCK_BILLING_PROVIDER,
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      offerPriceKey: this.offerPriceKey(subscription),
      membership: toMembership(subscription),
    };
    return { kind: 'membership', ...change };
  }
}
