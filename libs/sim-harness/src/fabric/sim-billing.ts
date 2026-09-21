/**
 * The payment provider node.
 *
 * Production bills through Stripe, so the simulation runs a whole payment
 * provider: its own origin, its own customers, subscriptions, invoices and
 * test clocks, its own hosted checkout and portal. Nothing about it is shared
 * with the API — the API reaches it through the membership adapter over the
 * network, and it reaches the API only by delivering signed webhooks through
 * the load balancer, as Stripe does.
 *
 * It sits on `createSimNet` like every other node, so it can be partitioned
 * away from the API (webhooks retry) or from a client's browser.
 */
import type { ServerHttp } from '@libs/client-app/shell/client-env';
import {
  SIM_BILLING_SECRET_KEY,
  SIM_BILLING_URL,
  SIM_BILLING_WEBHOOK_SECRET,
  SIM_SERVER_URL,
} from '@libs/feature/public/sim-constants';
import type { PlusMembershipOffer } from '@pkgs/billing';
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

export const SIM_BILLING_ID = 'billing';

/** The provider as a sim node, plus the key its API takes. */
export type SimBillingProvider = {
  readonly offer: PlusMembershipOffer;
  readonly provider: MockBillingProvider;
  readonly origin: string;
  readonly secretKey: string;
  /** Operator access (tests, the simulator's controls): no network hop. */
  readonly fetch: ServerHttp;
};

export async function createSimBillingProvider(deps: {
  readonly offer: PlusMembershipOffer;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly sqlClient: SqlClient;
  /** How the provider reaches the API (the load balancer, from this node). */
  readonly toApi: () => ServerHttp;
}): Promise<SimBillingProvider> {
  const provider = await createMockBillingProvider({
    sqlClient: deps.sqlClient,
    clock: deps.clock,
    timers: deps.timers,
    createId: deps.createId,
    fetch: (input, init) => deps.toApi()(input, init),
    origin: SIM_BILLING_URL,
    catalog: mockBillingCatalogFromOffer(deps.offer),
    secretKey: SIM_BILLING_SECRET_KEY,
    webhook: {
      url: `${SIM_SERVER_URL}${deps.offer.callbackPath}`,
      secret: SIM_BILLING_WEBHOOK_SECRET,
    },
  });
  return {
    offer: deps.offer,
    provider,
    origin: SIM_BILLING_URL,
    secretKey: SIM_BILLING_SECRET_KEY,
    fetch: async (input, init) =>
      provider.app.fetch(new Request(requestHref(input), init)),
  };
}

/** A node's HTTP port to the provider, gated by the network. */
export function simBillingFetchFrom(args: {
  readonly billing: SimBillingProvider;
  readonly net: SimNet;
  readonly from: string;
}): ServerHttp {
  return args.net.wrapHop(args.from, SIM_BILLING_ID, args.billing.fetch);
}

/** The node and the SQLite it keeps its state in. */
export type SimBillingNode = {
  readonly provider: SimBillingProvider;
  readonly sql: SimSql;
};

/** Boots the provider node when the composition sells something. */
export async function openSimBillingNode(args: {
  readonly offer: PlusMembershipOffer | undefined;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly toApi: () => ServerHttp;
}): Promise<SimBillingNode | null> {
  const offer = args.offer;
  if (offer === undefined) return null;
  const sql = await openFreshSimClientSql('sim_billing', args.clock);
  const provider = await createSimBillingProvider({
    offer,
    clock: args.clock,
    timers: args.timers,
    createId: args.createId,
    sqlClient: sql.sqlClient,
    toApi: args.toApi,
  });
  return { provider, sql };
}

/**
 * One API instance's membership adapter — the same one production runs —
 * or `null` when the sim sells nothing.
 */
export function simMembershipBilling(args: {
  readonly billing: SimBillingProvider | null;
  readonly net: SimNet;
  readonly from: string;
  readonly clock: Clock;
}): MockMembershipBilling | null {
  const billing = args.billing;
  if (billing === null) return null;
  return new MockMembershipBilling({
    origin: SIM_BILLING_URL,
    secretKey: SIM_BILLING_SECRET_KEY,
    webhookSecret: SIM_BILLING_WEBHOOK_SECRET,
    offer: billing.offer,
    now: () => args.clock.now(),
    fetch: simBillingFetchFrom({ billing, net: args.net, from: args.from }),
  });
}
