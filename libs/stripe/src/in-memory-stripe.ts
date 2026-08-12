import type Stripe from 'stripe';

export type InMemoryStripeOptions = {
  /** Default portal / checkout session URL host. */
  readonly baseUrl?: string;
  readonly failNextPortal?: boolean;
};

type SessionCreate = {
  customer: string;
  return_url?: string;
  success_url?: string;
  cancel_url?: string;
  mode?: string;
  line_items?: unknown;
};

/**
 * Minimal structural Stripe façade for sims / tests.
 * Covers billing portal (and checkout session create) used by StripeApp routes.
 */
export function createInMemoryStripe(
  options: InMemoryStripeOptions = {}
): Stripe {
  const baseUrl = options.baseUrl ?? 'https://stripe.sim.local';
  let portalFailArmed = options.failNextPortal === true;
  let sessionSeq = 0;

  const stripe = {
    billingPortal: {
      sessions: {
        create: async (params: SessionCreate) => {
          if (portalFailArmed) {
            portalFailArmed = false;
            throw new Error('in-memory stripe: portal failed');
          }
          sessionSeq += 1;
          return {
            id: `bps_sim_${sessionSeq}`,
            object: 'billing_portal.session',
            customer: params.customer,
            url: `${baseUrl}/portal/${params.customer}`,
            return_url: params.return_url ?? null,
            created: 1_700_000_000,
            livemode: false,
          };
        },
      },
    },
    checkout: {
      sessions: {
        create: async (params: SessionCreate) => {
          sessionSeq += 1;
          return {
            id: `cs_sim_${sessionSeq}`,
            object: 'checkout.session',
            url: `${baseUrl}/checkout/${sessionSeq}`,
            success_url: params.success_url ?? null,
            cancel_url: params.cancel_url ?? null,
            mode: params.mode ?? 'payment',
            status: 'open',
          };
        },
      },
    },
    products: {
      list: async function* () {
        // empty catalog
      },
      create: async (params: {
        name: string;
        metadata?: Record<string, string>;
      }) => ({
        id: `prod_sim_${++sessionSeq}`,
        object: 'product',
        active: true,
        name: params.name,
        metadata: params.metadata ?? {},
      }),
      update: async (id: string, params: Record<string, unknown>) => ({
        id,
        object: 'product',
        ...params,
      }),
    },
    prices: {
      list: async () => ({ data: [], has_more: false, object: 'list' }),
      create: async (params: Record<string, unknown>) => ({
        id: `price_sim_${++sessionSeq}`,
        object: 'price',
        active: true,
        ...params,
      }),
      update: async (id: string, params: Record<string, unknown>) => ({
        id,
        object: 'price',
        ...params,
      }),
      retrieve: async (id: string) => ({
        id,
        object: 'price',
        active: true,
      }),
    },
    /** Test knob: arm portal failure once. */
    failNextPortal(): void {
      portalFailArmed = true;
    },
  };

  return stripe as unknown as Stripe;
}
