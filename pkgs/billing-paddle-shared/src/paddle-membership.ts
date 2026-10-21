/**
 * Paddle adapter for the membership port — the counterpart of
 * `StripeMembershipBilling`. The only file that knows a Paddle status name,
 * event name or custom-data key. It reaches Paddle only over its REST API
 * with a server-side key and learns what changed only from signed webhooks;
 * the app cannot tell it from Stripe.
 */
import type {
  CallbackResult,
  Membership,
  MembershipBilling,
  MembershipChange,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared/membership';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared/offer';
import { isMembershipLive } from '@pkgs/billing-root-shared/precedence';

import {
  PADDLE_MEMBERSHIP_CALLBACK_EVENTS,
  PADDLE_PAYMENT_CALLBACK_EVENT,
  PADDLE_SUBSCRIPTION_ENDED_EVENT,
} from './callback-events';
import { membershipStatusOf } from './membership-status';
import type { PaddleFetch } from './paddle-api';
import { PaddleApi, paddleOriginForApiKey } from './paddle-api';
import { PaddleApiError } from './paddle-api-error';
import type { RefundAdjustment, RefundLineItem } from './refund-plan';
import { planPaddleRefund } from './refund-plan';
import { verifyPaddleSignature } from './signature';
import type {
  PaddleCustomer,
  PaddleEvent,
  PaddlePortalSession,
  PaddlePrice,
  PaddleSubscription,
  PaddleTransaction,
} from './wire';
import { PADDLE_CUSTOM_DATA, PADDLE_SIGNATURE_HEADER } from './wire';

/** The adapter's id: it keys stored data, so it never changes. */
export const PADDLE_PROVIDER = 'paddle';

export type PaddleMembershipBillingOptions = {
  readonly apiKey: string;
  /** Without it callbacks fail closed while checkout/portal keep working. */
  readonly webhookSecret: string | null;
  readonly offer: PlusMembershipOffer;
  readonly now: () => number;
  readonly fetch: PaddleFetch;
  /** Defaults to Paddle's sandbox or live origin, by the key's prefix. */
  readonly origin?: string;
  /**
   * A Paddle hosted checkout link. Checkout appends the transaction to it;
   * without one, people go to the account's default payment link.
   */
  readonly checkoutUrl?: string | null;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readTimeMs(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * When access runs out. A live subscription runs to its billing period's end;
 * Paddle clears the period once a subscription is paused or canceled, so an
 * ended one ends when it stopped — or at the period end, if that came first.
 */
function accessEndMs(
  subscription: PaddleSubscription,
  ended: boolean
): number | null {
  const periodEndMs = readTimeMs(subscription.current_billing_period?.ends_at);
  if (!ended) return periodEndMs;
  const stoppedMs =
    readTimeMs(subscription.canceled_at) ?? readTimeMs(subscription.paused_at);
  if (stoppedMs === null) return periodEndMs;
  return periodEndMs === null ? stoppedMs : Math.min(periodEndMs, stoppedMs);
}

function toMembership(
  subscription: PaddleSubscription,
  forcedEnded: boolean
): Membership {
  const status = forcedEnded
    ? 'ended'
    : membershipStatusOf(subscription.status);
  const scheduled = subscription.scheduled_change?.action;
  return {
    status,
    periodEndMs: accessEndMs(subscription, status === 'ended'),
    // A scheduled cancel or pause both stop the membership at the period end.
    endsAtPeriodEnd:
      status !== 'ended' && (scheduled === 'cancel' || scheduled === 'pause'),
  };
}

export class PaddleMembershipBilling implements MembershipBilling {
  async cancelMembership(subscriptionId: string): Promise<void> {
    const subscription = await this.current(subscriptionId);
    if (subscription === null || subscription.status === 'canceled') return;
    await this.api.data(
      'POST',
      `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      { effective_from: 'immediately' }
    );
  }

  async readPayments(customerId: string) {
    const transactions = await this.api.list<{
      id: string;
      updated_at: string;
      currency_code: string;
      details: { totals: { grand_total: string } };
      payments: readonly { captured_at: string | null; status: string }[];
    }>(
      `/transactions?customer_id=${encodeURIComponent(customerId)}&status=completed&per_page=200`
    );
    return Promise.all(
      transactions.map(async (transaction) => {
        const adjustments = await this.api.list<{
          action: string;
          status: string;
          totals: { total: string };
        }>(
          `/adjustments?transaction_id=${encodeURIComponent(transaction.id)}&per_page=200`
        );
        const paid = transaction.payments
          .filter((payment) => payment.status === 'captured')
          .map((payment) => Date.parse(payment.captured_at ?? ''));
        return {
          id: transaction.id,
          paidAtMs: Math.max(...paid),
          amountMinor: Number(transaction.details.totals.grand_total),
          currency: transaction.currency_code,
          refundedMinor: adjustments
            .filter(
              (adjustment) =>
                adjustment.action === 'refund' &&
                adjustment.status === 'approved'
            )
            .reduce(
              (sum, adjustment) => sum + Number(adjustment.totals.total),
              0
            ),
        };
      })
    );
  }

  async refundPayment(paymentId: string): Promise<void> {
    const adjustments = await this.api.list<RefundAdjustment>(
      `/adjustments?transaction_id=${encodeURIComponent(paymentId)}&per_page=200`
    );
    if (
      adjustments.some(
        (adjustment) =>
          adjustment.action === 'refund' &&
          adjustment.status === 'pending_approval'
      )
    )
      return;
    const hasApproved = adjustments.some(
      (entry) => entry.action === 'refund' && entry.status === 'approved'
    );
    const transaction = hasApproved
      ? await this.api.data<{
          details: { line_items: readonly RefundLineItem[] };
        }>('GET', `/transactions/${encodeURIComponent(paymentId)}`)
      : null;
    const plan = planPaddleRefund(
      adjustments,
      transaction?.details.line_items ?? []
    );
    if (plan === null) return;
    await this.api.data('POST', '/adjustments', {
      action: 'refund',
      transaction_id: paymentId,
      ...plan,
      reason: 'Membership payment after confirmed account deletion',
    });
  }
  readonly provider = PADDLE_PROVIDER;
  private readonly api: PaddleApi;

  constructor(private readonly options: PaddleMembershipBillingOptions) {
    this.api = new PaddleApi({
      apiKey: options.apiKey,
      origin: options.origin ?? paddleOriginForApiKey(options.apiKey),
      fetch: options.fetch,
    });
  }

  /**
   * Paddle keys customers by email: minting one for an email it already
   * knows is a conflict, and the customer it names is the one to use.
   */
  private async mintCustomer(input: StartCheckoutInput): Promise<string> {
    if (input.email === null) {
      throw new Error(
        'paddle: a customer needs an email, and the account has none'
      );
    }
    try {
      const customer = await this.api.data<PaddleCustomer>(
        'POST',
        '/customers',
        {
          email: input.email,
          custom_data: { [PADDLE_CUSTOM_DATA.accountId]: input.accountId },
        }
      );
      return customer.id;
    } catch (error) {
      if (
        !(error instanceof PaddleApiError) ||
        error.code !== 'customer_already_exists'
      ) {
        throw error;
      }
      const query = new URLSearchParams({ email: input.email });
      const existing = await this.api.data<readonly PaddleCustomer[]>(
        'GET',
        `/customers?${query.toString()}`
      );
      const id = existing[0]?.id;
      if (id === undefined) throw error;
      return id;
    }
  }

  private async priceFor(catalogPriceId: string): Promise<PaddlePrice> {
    const prices = await this.api.list<PaddlePrice>(
      '/prices?status=active&per_page=200'
    );
    const price = prices.find(
      (candidate) =>
        candidate.custom_data?.[PADDLE_CUSTOM_DATA.catalogPriceId] ===
        catalogPriceId
    );
    if (price === undefined) {
      throw new Error(
        `paddle: no active price for lookup key ${catalogPriceId}`
      );
    }
    return price;
  }

  private checkoutLink(transaction: PaddleTransaction): string {
    const hosted = this.options.checkoutUrl ?? null;
    if (hosted === null) return transaction.checkout?.url ?? '';
    const url = new URL(hosted);
    url.searchParams.set('transaction_id', transaction.id);
    return url.toString();
  }

  /** The subscription Paddle holds for `customerId` that is live, if any. */
  private async liveSubscription(
    customerId: string
  ): Promise<PaddleSubscription | null> {
    const query = new URLSearchParams({
      customer_id: customerId,
      status: 'active,trialing,past_due',
      per_page: '200',
    });
    const live = await this.api.list<PaddleSubscription>(
      `/subscriptions?${query.toString()}`
    );
    return (
      live.find((subscription) =>
        isMembershipLive(membershipStatusOf(subscription.status))
      ) ?? null
    );
  }

  /**
   * The customer's newest checkout that can still take a payment. Paddle's
   * hosted checkout has no return URL of its own, so any open one will do.
   */
  private async openCheckout(
    customerId: string
  ): Promise<PaddleTransaction | null> {
    const query = new URLSearchParams({
      customer_id: customerId,
      status: 'ready',
      per_page: '200',
    });
    const ready = await this.api.list<PaddleTransaction>(
      `/transactions?${query.toString()}`
    );
    return ready.at(-1) ?? null;
  }

  async startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    if (input.customerId !== null) {
      const customerId = input.customerId;
      const live = await this.liveSubscription(customerId);
      const change = live === null ? null : this.changeOf(live, false);
      if (change !== null) {
        return { kind: 'live_membership', customerId, change };
      }
      const open = await this.openCheckout(customerId);
      if (open !== null) {
        return { kind: 'checkout', customerId, url: this.checkoutLink(open) };
      }
    }
    const customer = input.customerId ?? (await this.mintCustomer(input));
    const { offer } = this.options;
    const spec = offer.prices[offer.defaultPriceKey];
    if (spec === undefined) {
      throw new Error(
        `paddle: no offer price for key ${offer.defaultPriceKey}`
      );
    }
    const price = await this.priceFor(spec.catalogPriceId);
    // The trial rides on the price itself (`reconcilePaddleOffer`), and the
    // transaction's custom data is copied onto the subscription it creates.
    const transaction = await this.api.data<PaddleTransaction>(
      'POST',
      '/transactions',
      {
        items: [{ price_id: price.id, quantity: 1 }],
        customer_id: customer,
        collection_mode: 'automatic',
        custom_data: { [PADDLE_CUSTOM_DATA.accountId]: input.accountId },
      }
    );
    return {
      kind: 'checkout',
      customerId: customer,
      url: this.checkoutLink(transaction),
    };
  }

  async openPortal(input: OpenPortalInput): Promise<{ readonly url: string }> {
    const session = await this.api.data<PaddlePortalSession>(
      'POST',
      `/customers/${encodeURIComponent(input.customerId)}/portal-sessions`,
      {}
    );
    return { url: session.urls.general.overview };
  }

  private verified(input: ReadCallbackInput): PaddleEvent | null {
    const secret = this.options.webhookSecret;
    const header = input.headers.get(PADDLE_SIGNATURE_HEADER);
    if (secret === null || header === null) return null;
    const ok = verifyPaddleSignature({
      secret,
      payload: input.rawBody,
      header,
      nowMs: this.options.now(),
    });
    if (!ok) return null;
    try {
      return JSON.parse(input.rawBody) as PaddleEvent;
    } catch {
      return null;
    }
  }

  private offerPriceKey(subscription: PaddleSubscription): string | null {
    const catalogPriceId = readString(
      subscription.items[0]?.price.custom_data?.[
        PADDLE_CUSTOM_DATA.catalogPriceId
      ]
    );
    if (catalogPriceId === null) return null;
    const match = Object.values(this.options.offer.prices).find(
      (spec) => spec.catalogPriceId === catalogPriceId
    );
    return match?.key ?? null;
  }

  /**
   * The subscription as Paddle reports it now. One Paddle does not know is
   * nothing to project; any other failure throws so the delivery is retried.
   */
  private async current(id: string): Promise<PaddleSubscription | null> {
    try {
      return await this.api.data<PaddleSubscription>(
        'GET',
        `/subscriptions/${encodeURIComponent(id)}`
      );
    } catch (error) {
      if (error instanceof PaddleApiError && error.status === 404) return null;
      throw error;
    }
  }

  async readCallback(input: ReadCallbackInput): Promise<CallbackResult> {
    const event = this.verified(input);
    if (event === null) return { kind: 'unverified' };
    if (event.event_type === PADDLE_PAYMENT_CALLBACK_EVENT) {
      const customerId = readString(event.data['customer_id']);
      return customerId === null
        ? { kind: 'ignored' }
        : {
            kind: 'payments',
            provider: this.provider,
            customerId,
          };
    }
    if (PADDLE_MEMBERSHIP_CALLBACK_EVENTS[event.event_type] !== true) {
      return { kind: 'ignored' };
    }
    const id = readString(event.data.id);
    if (id === null) return { kind: 'ignored' };
    // Paddle delivers duplicates and out of order; the payload is a snapshot
    // from whenever the event fired. Re-read so every delivery reports now;
    // a cancellation is final, whatever a lagging read still says.
    const subscription = await this.current(id);
    if (subscription === null) return { kind: 'ignored' };
    const change = this.changeOf(
      subscription,
      event.event_type === PADDLE_SUBSCRIPTION_ENDED_EVENT
    );
    return change === null
      ? { kind: 'ignored' }
      : { kind: 'membership', ...change };
  }

  async readMembership(subscriptionId: string) {
    const subscription = await this.current(subscriptionId);
    return subscription === null ? null : this.changeOf(subscription, false);
  }

  /**
   * What a subscription as Paddle reports it now means for the membership —
   * the one reading every callback, re-check and checkout shares. `null`
   * when it names no customer.
   */
  private changeOf(
    subscription: PaddleSubscription,
    ended: boolean
  ): MembershipChange | null {
    const customerId = readString(subscription.customer_id);
    if (customerId === null) return null;
    return {
      provider: this.provider,
      customerId,
      subscriptionId: subscription.id,
      offerPriceKey: this.offerPriceKey(subscription),
      membership: toMembership(subscription, ended),
    };
  }
}
