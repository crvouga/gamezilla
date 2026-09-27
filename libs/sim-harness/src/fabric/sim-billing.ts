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
 * It sits on `createSimNet` like every other node, so it can be partitioned
 * away from the API (webhooks retry) or from a client's browser.
 *
 * A sim boots with one provider. The team may switch payment provider
 * ({@link SimBillingProviders.switchCheckout}): the new one boots as a node of
 * its own — its own id, origin, keys and state — and new checkouts go there,
 * while every provider booted so far keeps serving its members.
 */
import type { ServerHttp } from '@libs/client-app/shell/client-env';
import {
  SIM_BILLING_SECRET_KEY,
  SIM_BILLING_WEBHOOK_SECRET,
  SIM_FIRST_BILLING_PROVIDER,
  SIM_SERVER_URL,
  simBillingOrigin,
} from '@libs/feature/public/sim-constants';
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

import { requestHref } from './sim-http-request';
import type { SimNet } from './sim-net';
import { openFreshSimClientSql, type SimSql } from './sim-sql';

/** The first provider's network node id; later ones are `billing-<id>`. */
export const SIM_BILLING_ID = 'billing';

function netNodeOf(provider: string): string {
  return provider === SIM_FIRST_BILLING_PROVIDER
    ? SIM_BILLING_ID
    : `${SIM_BILLING_ID}-${provider}`;
}

function keysOf(provider: string): {
  readonly secretKey: string;
  readonly webhookSecret: string;
} {
  return provider === SIM_FIRST_BILLING_PROVIDER
    ? {
        secretKey: SIM_BILLING_SECRET_KEY,
        webhookSecret: SIM_BILLING_WEBHOOK_SECRET,
      }
    : {
        secretKey: `${SIM_BILLING_SECRET_KEY}_${provider}`,
        webhookSecret: `${SIM_BILLING_WEBHOOK_SECRET}_${provider}`,
      };
}

/** One provider as a sim node, plus the key its API takes. */
export type SimBillingProvider = {
  /** The id the app knows it by: its callback path, its customer links. */
  readonly id: string;
  readonly offer: PlusMembershipOffer;
  readonly provider: MockBillingProvider;
  readonly origin: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
  /** Its node on the sim network. */
  readonly netNode: string;
  /** Operator access (tests, the simulator's controls): no network hop. */
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

async function createSimBillingProvider(
  deps: ProviderDeps & {
    readonly id: string;
    readonly sqlClient: SqlClient;
  }
): Promise<SimBillingProvider> {
  const origin = simBillingOrigin(deps.id);
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
      url: `${SIM_SERVER_URL}${membershipCallbackPath(deps.offer, deps.id)}`,
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
export function simBillingFetchFrom(args: {
  readonly billing: SimBillingProvider;
  readonly net: SimNet;
  readonly from: string;
}): ServerHttp {
  return args.net.wrapHop(args.from, args.billing.netNode, args.billing.fetch);
}

/**
 * Every payment provider the sim has booted, and the one new checkouts go
 * to. A booted provider is never retired: its members keep being served
 * where they subscribed.
 */
export type SimBillingProviders = {
  readonly offer: PlusMembershipOffer;
  /** Every booted provider, the first first. */
  all(): readonly SimBillingProvider[];
  get(id: string): SimBillingProvider | undefined;
  /** The provider new checkouts go to. */
  checkout(): SimBillingProvider;
  /** The provider whose origin `href` is on, if any. */
  at(href: string): SimBillingProvider | undefined;
  /**
   * The team switches payment provider: new checkouts go to `id` from now
   * on, booting it the first time. Switching back is switching to the first.
   */
  switchCheckout(id: string): Promise<SimBillingProvider>;
  dispose(): Promise<void>;
};

async function bootProvider(
  deps: ProviderDeps,
  id: string
): Promise<{ readonly provider: SimBillingProvider; readonly sql: SimSql }> {
  const sql = await openFreshSimClientSql(
    id === SIM_FIRST_BILLING_PROVIDER ? 'sim_billing' : `sim_billing_${id}`,
    deps.clock
  );
  const provider = await createSimBillingProvider({
    ...deps,
    id,
    sqlClient: sql.sqlClient,
  });
  return { provider, sql };
}

/** Boots the first provider when the composition sells something. */
export async function openSimBillingProviders(args: {
  readonly offer: PlusMembershipOffer | undefined;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly toApi: (netNode: string) => ServerHttp;
}): Promise<SimBillingProviders | null> {
  const offer = args.offer;
  if (offer === undefined) return null;
  const deps: ProviderDeps = { ...args, offer };
  const first = await bootProvider(deps, SIM_FIRST_BILLING_PROVIDER);
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
 * production registers its providers — or `null` when the sim sells nothing.
 * The registry is re-read at each request, so a switch of payment provider
 * reaches every instance at once, as a redeploy with the new configuration
 * would.
 */
export function simMembershipBilling(args: {
  readonly billing: SimBillingProviders | null;
  readonly net: SimNet;
  readonly from: string;
  readonly clock: Clock;
}): MembershipProviders | null {
  const billing = args.billing;
  if (billing === null) return null;
  const adapters = new Map<string, MockMembershipBilling>();
  const adapterOf = (node: SimBillingProvider): MockMembershipBilling => {
    const known = adapters.get(node.id);
    if (known !== undefined) return known;
    const adapter = new MockMembershipBilling({
      provider: node.id,
      origin: node.origin,
      secretKey: node.secretKey,
      webhookSecret: node.webhookSecret,
      offer: billing.offer,
      now: () => args.clock.now(),
      fetch: simBillingFetchFrom({
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
