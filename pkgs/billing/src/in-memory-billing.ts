import type {
  Billing,
  BillingCustomer,
  BillingEvent,
  CheckoutSession,
  CreateCheckoutSessionInput,
  CreateCustomerInput,
  CreatePortalSessionInput,
  PortalSession,
  VerifyWebhookInput,
} from './billing';
import type {
  CatalogSpec,
  CatalogSyncResult,
  PriceSpec,
  ProductSpec,
} from './catalog';

export type InMemoryBillingOptions = {
  /** Default portal session URL host. */
  readonly baseUrl?: string;
  readonly failNextPortal?: boolean;
};

/** Test knob: the next `verifyWebhook` reports this subscription change. */
export type InMemoryBillingWebhook = {
  readonly status: string;
  readonly currentPeriodEndMs: number | null;
  readonly cancelAtPeriodEnd: boolean;
};

type MemProduct = {
  readonly id: string;
  catalogProductId: string;
  name: string;
  description: string;
  active: boolean;
};

type MemPrice = {
  readonly id: string;
  lookupKey: string;
  productId: string;
  unitAmount: number;
  currency: string;
  recurring: PriceSpec['recurring'];
  currencyOptions: PriceSpec['currencyOptions'];
  active: boolean;
};

/**
 * Deterministic in-process {@link Billing} for sims / tests.
 * No network; sequential ids; optional one-shot portal failure knob.
 */
export class InMemoryBilling implements Billing {
  private readonly baseUrl: string;
  private portalFailArmed: boolean;
  private pendingWebhook: InMemoryBillingWebhook | null = null;
  private seq = 0;
  private readonly customers = new Map<string, string>();
  private readonly products = new Map<string, MemProduct>();
  private readonly prices = new Map<string, MemPrice>();

  constructor(options: InMemoryBillingOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://billing.sim.local';
    this.portalFailArmed = options.failNextPortal === true;
  }

  /** Test knob: arm portal failure once. */
  armPortalFailure(): void {
    this.portalFailArmed = true;
  }

  /** Test knob: the next `verifyWebhook` reports this change. */
  armWebhook(change: InMemoryBillingWebhook): void {
    this.pendingWebhook = change;
  }

  async createCustomer(input: CreateCustomerInput): Promise<BillingCustomer> {
    const existing = this.customers.get(input.accountId);
    if (existing !== undefined) return { customerId: existing };
    this.seq += 1;
    const customerId = `cus_sim_${this.seq}`;
    this.customers.set(input.accountId, customerId);
    return { customerId };
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSession> {
    this.seq += 1;
    const id = `cs_sim_${this.seq}`;
    return {
      id,
      url: `${this.baseUrl}/checkout/${input.priceKey}/${input.customerId}`,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<BillingEvent> {
    if (input.signature.length === 0) {
      throw new Error('in-memory billing: missing webhook signature');
    }
    if (this.pendingWebhook === null) {
      return { kind: 'ignored', type: 'unarmed' };
    }
    const change = this.pendingWebhook;
    this.pendingWebhook = null;
    const accountId = /"accountId":"([^"]+)"/.exec(input.rawBody)?.[1] ?? null;
    const subscriptionId =
      /"subscriptionId":"([^"]+)"/.exec(input.rawBody)?.[1] ?? 'sub_sim_1';
    return {
      kind: 'subscription_changed',
      accountId,
      providerSubscriptionId: subscriptionId,
      priceKey: 'subscription_monthly',
      status: change.status,
      currentPeriodEndMs: change.currentPeriodEndMs,
      cancelAtPeriodEnd: change.cancelAtPeriodEnd,
    };
  }

  async createPortalSession(
    input: CreatePortalSessionInput
  ): Promise<PortalSession> {
    if (this.portalFailArmed) {
      this.portalFailArmed = false;
      throw new Error('in-memory billing: portal failed');
    }
    this.seq += 1;
    return {
      id: `bps_sim_${this.seq}`,
      url: `${this.baseUrl}/portal/${input.customerId}`,
    };
  }

  async syncCatalog(spec: CatalogSpec): Promise<CatalogSyncResult> {
    const productEntries: Array<{ key: string; productId: string }> = [];
    const productIdsByKey: Record<string, string> = {};

    for (const [key, def] of Object.entries(spec.products)) {
      const id = this.ensureProduct(def);
      productIdsByKey[key] = id;
      productEntries.push({ key, productId: id });
    }

    const priceEntries: Array<{ key: string; priceId: string }> = [];
    for (const [key, priceSpec] of Object.entries(spec.prices)) {
      const productId = productIdsByKey[priceSpec.product];
      if (productId === undefined) {
        throw new Error(
          `in-memory billing: unknown product ref "${priceSpec.product}" for price ${key}`
        );
      }
      const priceId = this.ensurePrice(priceSpec, productId);
      priceEntries.push({ key, priceId });
    }

    return { products: productEntries, prices: priceEntries };
  }

  private ensureProduct(def: ProductSpec): string {
    for (const p of this.products.values()) {
      if (p.active && p.catalogProductId === def.catalogProductId) {
        p.name = def.name;
        p.description = def.description;
        return p.id;
      }
    }
    this.seq += 1;
    const id = `prod_sim_${this.seq}`;
    this.products.set(id, {
      id,
      catalogProductId: def.catalogProductId,
      name: def.name,
      description: def.description,
      active: true,
    });
    return id;
  }

  private ensurePrice(spec: PriceSpec, productId: string): string {
    for (const p of this.prices.values()) {
      if (p.active && p.lookupKey === spec.lookupKey) {
        if (
          p.productId === productId &&
          p.unitAmount === spec.unitAmount &&
          p.currency === spec.currency &&
          p.recurring.interval === spec.recurring.interval &&
          (p.recurring.trialPeriodDays ?? null) ===
            (spec.recurring.trialPeriodDays ?? null)
        ) {
          return p.id;
        }
        p.active = false;
      }
    }
    this.seq += 1;
    const id = `price_sim_${this.seq}`;
    this.prices.set(id, {
      id,
      lookupKey: spec.lookupKey,
      productId,
      unitAmount: spec.unitAmount,
      currency: spec.currency,
      recurring: spec.recurring,
      currencyOptions: spec.currencyOptions,
      active: true,
    });
    return id;
  }
}
