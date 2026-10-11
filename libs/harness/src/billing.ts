/**
 * The payment provider nodes.
 *
 * Production bills through Stripe, so the simulation runs Stripe: the stateful
 * Stripe mock (`@crvouga/mockingbird-service-stripe`), with its own origin,
 * customers, subscriptions, invoices, hosted checkout and billing portal.
 * Nothing about it is shared with the API — the API reaches it through its
 * production Stripe adapter over the network, and it reaches the API only by
 * delivering signed webhooks through the load balancer, as Stripe does. Its
 * catalog, portal configuration and webhook endpoint are the ones the app's
 * own offer reconcile creates, as a deploy creates them.
 *
 * It sits on `createHarnessNet` like every other node, so it can be partitioned
 * away from the API (webhooks retry) or from a client's browser.
 *
 * Its clock is the harness clock, plus however far a tester moved the
 * provider's clock ahead ({@link HarnessBillingProvider.advanceClock}) — the
 * way a tester runs a Stripe test clock forward without the app's days
 * passing.
 *
 * A harness boots with one provider. The team may switch payment provider
 * ({@link HarnessBillingProviders.switchCheckout}): the new one — a second
 * Stripe account — boots as a node of its own, with its own id, origin, keys
 * and state, and new checkouts go there, while every provider booted so far
 * keeps serving its members.
 */

import {
  createRuntime,
  type StripeRuntime,
  type StripeRuntimeOptions,
} from '@crvouga/mockingbird-service-stripe';
import {
  HARNESS_BILLING_SECRET_KEY,
  HARNESS_FIRST_BILLING_PROVIDER,
  HARNESS_SERVER_URL,
  harnessBillingOrigin,
} from '@libs/sub-shared/harness-constants';
import type { ServerHttp } from '@libs/sub-shared/sync';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared/offer';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import {
  createMembershipProviders,
  membershipCallbackPath,
} from '@pkgs/billing-root-shared/providers';
import type { StripeMembershipBilling } from '@pkgs/billing-stripe-server/stripe-membership';
import {
  createStripeClient,
  createStripeMembershipBilling,
} from '@pkgs/billing-stripe-server/stripe-membership';
import { reconcileStripeOffer } from '@pkgs/billing-stripe-shared/offer-reconcile';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import type Stripe from 'stripe';

import { createStripeWebhookRelay } from './billing-webhooks';
import { requestHref } from './http-request';
import type { HarnessNet } from './net';

/** The first provider's network node id; later ones are `billing-<id>`. */
export const HARNESS_BILLING_ID = 'billing';

/** How often the provider runs what fell due (renewals, expiries). */
const LIFECYCLE_TICK_MS = 60_000;

function netNodeOf(provider: string): string {
  return provider === HARNESS_FIRST_BILLING_PROVIDER
    ? HARNESS_BILLING_ID
    : `${HARNESS_BILLING_ID}-${provider}`;
}

function secretKeyOf(provider: string): string {
  return provider === HARNESS_FIRST_BILLING_PROVIDER
    ? HARNESS_BILLING_SECRET_KEY
    : `${HARNESS_BILLING_SECRET_KEY}_${provider.replaceAll('-', '_')}`;
}

type ProviderClock = NonNullable<StripeRuntimeOptions['clock']>;

/** The harness clock, run ahead by however far a tester moved it. */
function providerClock(app: Clock): ProviderClock {
  let aheadMs = 0;
  const now = (): number => app.now() + aheadMs;
  return {
    now,
    set: (ms) => {
      aheadMs = Math.max(0, ms - app.now());
    },
    advance: (ms) => {
      aheadMs = Math.max(0, aheadMs + ms);
    },
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => {
      aheadMs = 0;
    },
    state: () => ({ now: now(), frozen: false, offsetMs: aheadMs }),
  };
}

/** One provider as a harness node, plus the keys its API takes. */
export type HarnessBillingProvider = {
  /** The id the app knows it by: its callback path, its customer links. */
  readonly id: string;
  readonly offer: PlusMembershipOffer;
  readonly origin: string;
  readonly secretKey: string;
  /** The signing secret of the webhook endpoint the offer reconcile made. */
  readonly webhookSecret: string;
  /** Its node on the harness network. */
  readonly netNode: string;
  /** Operator access (tests, the harness's controls): no network hop. */
  readonly fetch: ServerHttp;
  /** A tester's Stripe client, in test mode with the secret key. */
  readonly stripe: Stripe;
  /** The provider's clock, ahead of the harness clock by what testers moved. */
  now(): number;
  /** Run the provider's clock ahead by `ms`, and whatever fell due. */
  advanceClock(ms: number): Promise<void>;
  /** Deliver a webhook event again, as it was first sent. */
  resendEvent(eventId: string): void;
};

type ProviderDeps = {
  readonly offer: PlusMembershipOffer;
  readonly clock: Clock;
  readonly timers: Timers;
  /** How a provider reaches the API (the load balancer, from its node). */
  readonly toApi: (netNode: string) => ServerHttp;
};

type ProviderNode = {
  readonly provider: HarnessBillingProvider;
  dispose(): void;
};

async function bootProvider(
  deps: ProviderDeps,
  id: string
): Promise<ProviderNode> {
  const origin = harnessBillingOrigin(id);
  const netNode = netNodeOf(id);
  const secretKey = secretKeyOf(id);
  const clock = providerClock(deps.clock);
  const relay = createStripeWebhookRelay({
    endpoints: () => runtime.instance().apiWebhookEndpoints(),
    send: (input, init) => deps.toApi(netNode)(input, init),
    clock: deps.clock,
    timers: deps.timers,
  });
  const runtime: StripeRuntime = createRuntime({
    clock,
    accounts: [
      { id: `acct_${netNode.replaceAll('-', '_')}`, keys: [secretKey] },
    ],
    // The relay delivers (issue 160); the provider's own hub sends nothing.
    webhooks: { retryDelaysMs: [] },
    onWebhook: (event) => relay.publish(event),
  });
  const fetch: ServerHttp = async (input, init) =>
    await runtime.fetch(new Request(requestHref(input), init));
  const stripe = createStripeClient(secretKey, { origin, fetch });
  await reconcileStripeOffer(
    stripe,
    deps.offer,
    {
      callbackUrl: `${HARNESS_SERVER_URL}${membershipCallbackPath(deps.offer, id)}`,
    },
    createNoopLogger()
  );
  const endpoint = runtime.instance().apiWebhookEndpoints()[0];
  if (endpoint === undefined) {
    throw new Error(`billing: ${id} has no webhook endpoint after reconcile`);
  }
  const ticker = deps.timers.setInterval(
    () => runtime.tick(),
    LIFECYCLE_TICK_MS
  );
  const provider: HarnessBillingProvider = {
    id,
    offer: deps.offer,
    origin,
    secretKey,
    webhookSecret: endpoint.secret,
    netNode,
    fetch,
    stripe,
    now: () => clock.now(),
    advanceClock: async (ms) => {
      const response = await fetch(`${origin}/__admin/clock`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ advance: ms }),
      });
      if (!response.ok) {
        throw new Error(
          `billing: ${id} clock advance → ${String(response.status)}: ${await response.text()}`
        );
      }
    },
    resendEvent: (eventId) => relay.resend(eventId),
  };
  return {
    provider,
    dispose: () => {
      deps.timers.clearInterval(ticker);
      relay.dispose();
      runtime.stop();
    },
  };
}

/** A node's HTTP port to one provider, gated by the network. */
export function harnessBillingFetchFrom(args: {
  readonly billing: HarnessBillingProvider;
  readonly net: HarnessNet;
  readonly from: string;
}): ServerHttp {
  return args.net.wrapHop(args.from, args.billing.netNode, args.billing.fetch);
}

/**
 * Every payment provider the harness has booted, and the one new checkouts go
 * to. A booted provider is never retired: its members keep being served
 * where they subscribed.
 */
export type HarnessBillingProviders = {
  readonly offer: PlusMembershipOffer;
  /** Every booted provider, the first first. */
  all(): readonly HarnessBillingProvider[];
  get(id: string): HarnessBillingProvider | undefined;
  /** The provider new checkouts go to. */
  checkout(): HarnessBillingProvider;
  /** The provider whose origin `href` is on, if any. */
  at(href: string): HarnessBillingProvider | undefined;
  /**
   * The team switches payment provider: new checkouts go to `id` from now
   * on, booting it the first time. Switching back is switching to the first.
   */
  switchCheckout(id: string): Promise<HarnessBillingProvider>;
  dispose(): Promise<void>;
};

/** Boots the first provider when the composition sells something. */
export async function openHarnessBillingProviders(args: {
  readonly offer: PlusMembershipOffer | undefined;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly toApi: (netNode: string) => ServerHttp;
}): Promise<HarnessBillingProviders | null> {
  const offer = args.offer;
  if (offer === undefined) return null;
  const deps: ProviderDeps = { ...args, offer };
  const first = await bootProvider(deps, HARNESS_FIRST_BILLING_PROVIDER);
  const nodes = new Map([[first.provider.id, first]]);
  let checkoutId = first.provider.id;
  const providers = () => [...nodes.values()].map((n) => n.provider);
  const get = (id: string) => nodes.get(id)?.provider;
  return {
    offer,
    all: providers,
    get,
    checkout: () => {
      const provider = get(checkoutId);
      if (provider === undefined) {
        throw new Error(`billing: checkout provider ${checkoutId} not booted`);
      }
      return provider;
    },
    at: (href) =>
      providers().find(
        (p) => href === p.origin || href.startsWith(`${p.origin}/`)
      ),
    async switchCheckout(id) {
      if (!nodes.has(id)) nodes.set(id, await bootProvider(deps, id));
      checkoutId = id;
      const provider = get(id);
      if (provider === undefined) throw new Error(`billing: no ${id}`);
      return provider;
    },
    dispose() {
      for (const n of nodes.values()) n.dispose();
      return Promise.resolve();
    },
  };
}

/**
 * One API instance's membership providers — the production Stripe adapter
 * for every booted provider, registered exactly as production registers its
 * providers — or `null` when the harness sells nothing. The registry is
 * re-read at each request, so a switch of payment provider reaches every
 * instance at once, as a redeploy with the new configuration would.
 */
export function harnessMembershipBilling(args: {
  readonly billing: HarnessBillingProviders | null;
  readonly net: HarnessNet;
  readonly from: string;
  readonly clock: Clock;
}): MembershipProviders | null {
  const billing = args.billing;
  if (billing === null) return null;
  const adapters = new Map<string, StripeMembershipBilling>();
  const adapterOf = (node: HarnessBillingProvider): StripeMembershipBilling => {
    const known = adapters.get(node.id);
    if (known !== undefined) return known;
    const adapter = createStripeMembershipBilling({
      provider: node.id,
      secretKey: node.secretKey,
      webhookSecret: node.webhookSecret,
      offer: billing.offer,
      now: () => args.clock.now(),
      transport: {
        origin: node.origin,
        fetch: harnessBillingFetchFrom({
          billing: node,
          net: args.net,
          from: args.from,
        }),
      },
    });
    adapters.set(node.id, adapter);
    return adapter;
  };
  const current = (): MembershipProviders =>
    createMembershipProviders({
      all: billing.all().map(adapterOf),
      checkout: billing.checkout().id,
    });
  return {
    get checkout() {
      return current().checkout;
    },
    get byId() {
      return current().byId;
    },
  };
}
