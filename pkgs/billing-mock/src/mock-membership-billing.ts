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
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

function accessEndMs(
  subscription: MockSubscription,
  ended: boolean
): number | null {
  const item = subscription.items.data[0];
  const periodEndMs =
    item === undefined ? null : item.current_period_end * 1000;
  if (!ended || subscription.ended_at === null) return periodEndMs;
  const endedAtMs = subscription.ended_at * 1000;
  return periodEndMs === null ? endedAtMs : Math.min(periodEndMs, endedAtMs);
}

/** A deletion is final, whatever a lagging re-read still says. */
function toMembership(
  subscription: MockSubscription,
  deleted: boolean
): Membership {
  const status = deleted ? 'ended' : membershipStatusOf(subscription.status);
  return {
    status,
    periodEndMs: accessEndMs(subscription, status === 'ended'),
    endsAtPeriodEnd: status !== 'ended' && subscription.cancel_at_period_end,
  };
}

export class MockMembershipBilling implements MembershipBilling {
  readonly provider = MOCK_BILLING_PROVIDER;

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

  private async priceFor(catalogPriceId: string): Promise<MockPrice> {
    const query = new URLSearchParams({
      lookup_keys: catalogPriceId,
      active: 'true',
    });
    const prices = await this.call<MockList<MockPrice>>(
      'GET',
      `${MOCK_BILLING_PATHS.prices}?${query.toString()}`
    );
    const price = prices.data[0];
    if (price === undefined) {
      throw new Error(
        `mock billing: no active price for lookup key ${catalogPriceId}`
      );
    }
    return price;
  }

  async startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const customer =
      input.customerId ??
      (
        await this.call<MockCustomer>('POST', MOCK_BILLING_PATHS.customers, {
          ...(input.email === null ? {} : { email: input.email }),
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
    const price = await this.priceFor(spec.catalogPriceId);
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
      (spec) => spec.catalogPriceId === lookupKey
    );
    return match?.key ?? null;
  }

  /**
   * Deliveries repeat and arrive out of order, so every callback re-reads the
   * subscription. One the provider does not know (another account's, or
   * deleted with its customer) is nothing to project; any other failure
   * throws so the delivery is retried.
   */
  private async current(id: string): Promise<MockSubscription | null> {
    try {
      return await this.call<MockSubscription>(
        'GET',
        MOCK_BILLING_PATHS.subscription(id)
      );
    } catch (error) {
      if (error instanceof MockBillingApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async readCallback(input: ReadCallbackInput): Promise<CallbackResult> {
    const event = this.verified(input);
    if (event === null) return { kind: 'unverified' };
    if (!MEMBERSHIP_EVENTS.has(event.type)) return { kind: 'ignored' };
    const subscription = await this.current(event.data.object.id);
    if (subscription === null) return { kind: 'ignored' };
    const change: MembershipChange = {
      provider: this.provider,
      customerId: subscription.customer,
      subscriptionId: subscription.id,
      offerPriceKey: this.offerPriceKey(subscription),
      membership: toMembership(
        subscription,
        event.type === 'customer.subscription.deleted'
      ),
    };
    return { kind: 'membership', ...change };
  }
}
