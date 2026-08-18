/**
 * Catalog reconcile: declarative {@link STRIPE_CATALOG_SPEC} → Stripe Products/Prices.
 *
 * Pure orchestration — no secret resolution, no SQL. Callers pass a ready-to-use
 * Stripe client. Idempotent: identifies products by `metadata.catalog_product_id`
 * and prices by `lookup_key`; archives drifted prices and recreates with
 * `transfer_lookup_key`.
 */
import type Stripe from 'stripe';
import { STRIPE_CATALOG_SPEC } from '../../../../shared/stripe/catalog-spec';
import {
  decidePriceReconcile,
  type PriceSpecEntry,
  priceMatchesSpec,
  specCurrencyOptionsToStripe,
  stripePriceProductId,
} from '../../../../shared/stripe/catalog-sync-shared';

/** Stripe product metadata key used to match catalog product ids. */
export const STRIPE_CATALOG_PRODUCT_METADATA_KEY =
  'catalog_product_id' as const;

const TAG = 'stripe sync catalog';

export type CatalogProductSyncEntry = {
  readonly key: string;
  readonly stripeProductId: string;
};

export type CatalogPriceSyncEntry = {
  readonly key: string;
  readonly stripePriceId: string;
};

export type CatalogSyncResult = {
  readonly products: ReadonlyArray<CatalogProductSyncEntry>;
  readonly prices: ReadonlyArray<CatalogPriceSyncEntry>;
};

/** List active products and match `catalog_product_id` metadata (Search API
 *  is intentionally unused — it can miss rows and caused duplicate Products
 *  on every sync). */
async function findProductByCatalogId(
  stripe: Stripe,
  catalogProductId: string
): Promise<Stripe.Product | null> {
  const matches: Stripe.Product[] = [];
  for await (const p of stripe.products.list({ active: true, limit: 100 })) {
    if (
      p.metadata?.[STRIPE_CATALOG_PRODUCT_METADATA_KEY] === catalogProductId
    ) {
      matches.push(p);
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.created - b.created);
  const chosen = matches[0];
  if (chosen === undefined) return null;
  if (matches.length > 1) {
    console.warn(
      `[${TAG}] ${matches.length} active products share ${STRIPE_CATALOG_PRODUCT_METADATA_KEY}=${catalogProductId} — using ${chosen.id} (oldest). Archive extras in Stripe Dashboard if needed.`
    );
  }
  return chosen;
}

/** Prices with this lookup on another product block creates; archive them first. */
async function archiveOrphanPricesForLookup(
  stripe: Stripe,
  lookupKey: string,
  canonicalProductId: string
): Promise<void> {
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 20,
  });
  for (const p of listed.data) {
    const pid = stripePriceProductId(p.product);
    if (pid === null || pid === canonicalProductId) continue;
    await stripe.prices.update(p.id, { active: false });
    console.log(
      `[${TAG}] archived orphan price ${p.id} (${lookupKey} on ${pid}, canonical product is ${canonicalProductId})`
    );
  }
}

async function ensureProduct(
  stripe: Stripe,
  def: {
    readonly catalogProductId: string;
    readonly name: string;
    readonly description: string;
  }
): Promise<Stripe.Product> {
  const existing = await findProductByCatalogId(stripe, def.catalogProductId);
  if (existing !== null) {
    if (
      existing.name !== def.name ||
      existing.description !== def.description
    ) {
      await stripe.products.update(existing.id, {
        name: def.name,
        description: def.description,
      });
      console.log(
        `[${TAG}] updated product ${existing.id} (${STRIPE_CATALOG_PRODUCT_METADATA_KEY}=${def.catalogProductId})`
      );
    }
    return existing;
  }
  const created = await stripe.products.create({
    name: def.name,
    description: def.description,
    metadata: {
      [STRIPE_CATALOG_PRODUCT_METADATA_KEY]: def.catalogProductId,
    },
  });
  console.log(
    `[${TAG}] created product ${created.id} (${STRIPE_CATALOG_PRODUCT_METADATA_KEY}=${def.catalogProductId})`
  );
  return created;
}

async function findLivePriceForLookup(
  stripe: Stripe,
  lookupKey: string,
  productStripeId: string
): Promise<{
  readonly live: Stripe.Price | null;
  readonly liveDetail: Stripe.Price | null;
}> {
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 20,
  });
  const live =
    listed.data.find(
      (p) =>
        p.lookup_key === lookupKey &&
        stripePriceProductId(p.product) === productStripeId
    ) ?? null;
  if (live === null) return { live: null, liveDetail: null };
  const liveDetail = await stripe.prices.retrieve(live.id, {
    expand: ['currency_options'],
  });
  return { live, liveDetail };
}

async function reconcileOnePrice(args: {
  readonly stripe: Stripe;
  readonly priceKey: string;
  readonly spec: PriceSpecEntry;
  readonly productStripeId: string;
}): Promise<string> {
  const { stripe, priceKey, spec, productStripeId } = args;

  await archiveOrphanPricesForLookup(stripe, spec.lookup_key, productStripeId);

  const { live, liveDetail } = await findLivePriceForLookup(
    stripe,
    spec.lookup_key,
    productStripeId
  );

  const action = decidePriceReconcile(
    live ?? undefined,
    liveDetail ?? undefined,
    spec,
    productStripeId
  );

  if (action === 'noop' && live !== null) {
    console.log(`[${TAG}] price ${priceKey} (${spec.lookup_key}) unchanged`);
    return live.id;
  }

  if (
    live !== null &&
    liveDetail !== null &&
    !priceMatchesSpec(liveDetail, spec, productStripeId)
  ) {
    await stripe.prices.update(live.id, { active: false });
    console.log(`[${TAG}] archived price ${live.id} (${spec.lookup_key})`);
  }

  const created = await stripe.prices.create({
    product: productStripeId,
    unit_amount: spec.unit_amount,
    currency: spec.currency,
    recurring: {
      interval: spec.recurring.interval,
      ...(spec.recurring.trial_period_days === undefined
        ? {}
        : { trial_period_days: spec.recurring.trial_period_days }),
    },
    lookup_key: spec.lookup_key,
    transfer_lookup_key: live !== null,
    currency_options: specCurrencyOptionsToStripe(spec.currency_options),
  });
  console.log(`[${TAG}] created price ${created.id} (${spec.lookup_key})`);
  return created.id;
}

async function reconcileAllProducts(stripe: Stripe): Promise<{
  readonly entries: ReadonlyArray<CatalogProductSyncEntry>;
  readonly stripeIdsByKey: Readonly<Record<string, string>>;
}> {
  const entries: CatalogProductSyncEntry[] = [];
  const stripeIdsByKey: Record<string, string> = {};
  for (const [productKey, def] of Object.entries(
    STRIPE_CATALOG_SPEC.products
  )) {
    const p = await ensureProduct(stripe, def);
    stripeIdsByKey[productKey] = p.id;
    entries.push({ key: productKey, stripeProductId: p.id });
  }
  return { entries, stripeIdsByKey };
}

async function reconcileAllPrices(
  stripe: Stripe,
  productStripeIdsByKey: Readonly<Record<string, string>>
): Promise<{
  readonly entries: ReadonlyArray<CatalogPriceSyncEntry>;
  readonly stripeIdsByKey: Readonly<Record<string, string>>;
}> {
  const entries: CatalogPriceSyncEntry[] = [];
  const stripeIdsByKey: Record<string, string> = {};
  for (const [priceKey, spec] of Object.entries(STRIPE_CATALOG_SPEC.prices)) {
    const productStripeId = productStripeIdsByKey[spec.product];
    if (productStripeId === undefined) {
      throw new Error(
        `[${TAG}] unknown product ref "${spec.product}" for price ${priceKey}`
      );
    }
    const stripePriceId = await reconcileOnePrice({
      stripe,
      priceKey,
      spec,
      productStripeId,
    });
    stripeIdsByKey[priceKey] = stripePriceId;
    entries.push({ key: priceKey, stripePriceId });
  }
  return { entries, stripeIdsByKey };
}

/**
 * Reconcile Stripe Products/Prices to match {@link STRIPE_CATALOG_SPEC}.
 * Catalog persistence into entity_store is intentionally omitted until
 * Stripe rewires onto `@pkgs/entity-store`.
 */
export class StripeCatalogSync {
  constructor(private readonly stripe: Stripe) {}

  async run(): Promise<CatalogSyncResult> {
    const { entries: products, stripeIdsByKey: productIdsByKey } =
      await reconcileAllProducts(this.stripe);
    const { entries: prices } = await reconcileAllPrices(
      this.stripe,
      productIdsByKey
    );

    return { products, prices };
  }
}
