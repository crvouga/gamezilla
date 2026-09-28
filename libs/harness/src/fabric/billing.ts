/**
 * The payment provider nodes.
 *
 * Production bills through real providers, so the simulation runs a whole payment
 * provider: its own origin, its own customers, subscriptions, invoices and
 * test clocks, its own hosted checkout and portal. Nothing about it is shared
 * with the API — the API reaches it through the membership adapter over the
 * network, and it reaches the API only by delivering signed webhooks through
 * the load balancer, as real providers do.
 *
 * It sits on `createHarnessNet` like every other node, so it can be partitioned
 * away from the API (webhooks retry) or from a client's browser.
 *
 * A harness boots with one provider. The team may switch payment provider
 * ({@link HarnessBillingProviders.switchCheckout}): the new one boots as a node of
 * its own — its own id, origin, keys and state — and new checkouts go there,
 * while every provider booted so far keeps serving its members.
 */
import type { ServerHttp } from '@libs/client-app/shell/client-env';
import {
  HARNESS_BILLING_SECRET_KEY,
  HARNESS_BILLING_WEBHOOK_SECRET,
  HARNESS_FIRST_BILLING_PROVIDER,
  HARNESS_SERVER_URL,
  harnessBillingOrigin,
} from '@libs/feature/public/harness-constants';
import {
  createMembershipProviders,
  type MembershipProviders,
  membershipCallbackPath,
  type PlusMembershipOffer,
} from '@pkgs/billing';
import {
  MockMembershipBilling,
  mockBillingCatalogFromOffer,
} from '@pkgs/billing-mock';
import {
  createMockBillingProvider,
  type MockBillingProvider,
} from '@pkgs/billing-mock-provider/server';
import type { Clock, Timers } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import { requestHref } from './http-request';
import type { HarnessNet } from './net';
import { type HarnessSql, openFreshHarnessClientSql } from './sql';

/** The first provider's network node id; later ones are `billing-<id>`. */
export const HARNESS_BILLING_ID = 'billing';

function netNodeOf(provider: string): string {
  return provider === HARNESS_FIRST_BILLING_PROVIDER
    ? HARNESS_BILLING_ID
    : `${HARNESS_BILLING_ID}-${provider}`;
}

function keysOf(provider: string): {
  readonly secretKey: string;
  readonly webhookSecret: string;
} {
  return provider === HARNESS_FIRST_BILLING_PROVIDER
    ? {
        secretKey: HARNESS_BILLING_SECRET_KEY,
        webhookSecret: HARNESS_BILLING_WEBHOOK_SECRET,
      }
    : {
        secretKey: `${HARNESS_BILLING_SECRET_KEY}_${provider}`,
        webhookSecret: `${HARNESS_BILLING_WEBHOOK_SECRET}_${provider}`,
      };
}

/** One provider as a harness node, plus the key its API takes. */
export type HarnessBillingProvider = {
  /** The id the app knows it by: its callback path, its customer links. */
  readonly id: string;
  readonly offer: PlusMembershipOffer;
  readonly provider: MockBillingProvider;
  readonly origin: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
  /** Its node on the harness network. */
  readonly netNode: string;
  /** Operator access (tests, the harness's controls): no network hop. */
  readonly fetch: ServerHttp;
};

type ProviderDeps = {
  readonly offer: PlusMembershipOffer;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  /** How a provider reaches the API (the load balancer, from its node). */
  readonly toApi: (netNode: string) => ServerHttp;
};

async function createHarnessBillingProvider(
  deps: ProviderDeps & {
    readonly id: string;
    readonly sqlClient: SqlClient;
  }
): Promise<HarnessBillingProvider> {
  const origin = harnessBillingOrigin(deps.id);
  const keys = keysOf(deps.id);
  const netNode = netNodeOf(deps.id);
  const provider = await createMockBillingProvider({
    sqlClient: deps.sqlClient,
    clock: deps.clock,
    timers: deps.timers,
    createId: deps.createId,
    fetch: (input, init) => deps.toApi(netNode)(input, init),
    origin,
    catalog: mockBillingCatalogFromOffer(deps.offer),
    secretKey: keys.secretKey,
    webhook: {
      url: `${HARNESS_SERVER_URL}${membershipCallbackPath(deps.offer, deps.id)}`,
      secret: keys.webhookSecret,
    },
  });
  return {
    id: deps.id,
    offer: deps.offer,
    provider,
    origin,
    secretKey: keys.secretKey,
    webhookSecret: keys.webhookSecret,
    netNode,
    fetch: async (input, init) =>
      provider.app.fetch(new Request(requestHref(input), init)),
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

async function bootProvider(
  deps: ProviderDeps,
  id: string
): Promise<{
  readonly provider: HarnessBillingProvider;
  readonly sql: HarnessSql;
}> {
  const sql = await openFreshHarnessClientSql(
    id === HARNESS_FIRST_BILLING_PROVIDER
      ? 'harness_billing'
      : `harness_billing_${id}`,
    deps.clock
  );
  const provider = await createHarnessBillingProvider({
    ...deps,
    id,
    sqlClient: sql.sqlClient,
  });
  return { provider, sql };
}

/** Boots the first provider when the composition sells something. */
export async function openHarnessBillingProviders(args: {
  readonly offer: PlusMembershipOffer | undefined;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
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
    async dispose() {
      for (const n of nodes.values()) await n.sql.disconnect();
    },
  };
}

/**
 * One API instance's membership providers — the mock provider's adapter for
 * every booted provider, the same one the stack runs, registered exactly as
 * production registers its providers — or `null` when the harness sells nothing.
 * The registry is re-read at each request, so a switch of payment provider
 * reaches every instance at once, as a redeploy with the new configuration
 * would.
 */
export function harnessMembershipBilling(args: {
  readonly billing: HarnessBillingProviders | null;
  readonly net: HarnessNet;
  readonly from: string;
  readonly clock: Clock;
}): MembershipProviders | null {
  const billing = args.billing;
  if (billing === null) return null;
  const adapters = new Map<string, MockMembershipBilling>();
  const adapterOf = (node: HarnessBillingProvider): MockMembershipBilling => {
    const known = adapters.get(node.id);
    if (known !== undefined) return known;
    const adapter = new MockMembershipBilling({
      provider: node.id,
      origin: node.origin,
      secretKey: node.secretKey,
      webhookSecret: node.webhookSecret,
      offer: billing.offer,
      now: () => args.clock.now(),
      fetch: harnessBillingFetchFrom({
        billing: node,
        net: args.net,
        from: args.from,
      }),
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
