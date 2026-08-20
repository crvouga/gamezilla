/**
 * Stripe catalog reconcile — products by metadata.catalog_product_id,
 * prices by lookup_key.
 */
import {
  type CatalogSpec,
  type CatalogSyncResult,
  currencyOptionsToSnake,
  decidePriceReconcile,
  normalizeSnakeCurrencyOptions,
  type PriceSpec,
  type ProductSpec,
  priceMatchesSpec,
  priceProductId,
} from '@pkgs/billing';
import type Stripe from 'stripe';

/** Stripe product metadata key used to match catalog product ids. */
export const STRIPE_CATALOG_PRODUCT_METADATA_KEY =
  'catalog_product_id' as const;

const TAG = 'stripe sync catalog';

function toLiveSnapshot(price: Stripe.Price): {
  unitAmount: number | null;
  currency: string;
  recurring: {
    interval: string;
    trialPeriodDays?: number | null;
  } | null;
  active: boolean;
  product?: string | { id: string } | null;
  currencyOptions?: Record<string, { unitAmount?: number | null }> | null;
} {
  const snakeCo = normalizeSnakeCurrencyOptions(
    price.currency_options as
      | Record<string, { unit_amount?: number | null }>
      | null
      | undefined
  );
  const currencyOptions: Record<string, { unitAmount?: number | null }> = {};
  for (const [k, v] of Object.entries(snakeCo)) {
    currencyOptions[k] = { unitAmount: v };
  }
  return {
    unitAmount: price.unit_amount,
    currency: price.currency,
    recurring:
      price.recurring === null || price.recurring === undefined
        ? null
        : {
            interval: price.recurring.interval,
            trialPeriodDays: price.recurring.trial_period_days ?? null,
          },
    active: price.active,
    product: price.product,
    currencyOptions,
  };
}

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
    const pid = priceProductId(p.product);
    if (pid === null || pid === canonicalProductId) continue;
    await stripe.prices.update(p.id, { active: false });
    console.log(
      `[${TAG}] archived orphan price ${p.id} (${lookupKey} on ${pid}, canonical product is ${canonicalProductId})`
    );
  }
}

async function ensureProduct(
  stripe: Stripe,
  def: ProductSpec
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
  productId: string
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
        p.lookup_key === lookupKey && priceProductId(p.product) === productId
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
  readonly spec: PriceSpec;
  readonly productId: string;
}): Promise<string> {
  const { stripe, priceKey, spec, productId } = args;

  await archiveOrphanPricesForLookup(stripe, spec.lookupKey, productId);

  const { live, liveDetail } = await findLivePriceForLookup(
    stripe,
    spec.lookupKey,
    productId
  );

  const liveSnap = liveDetail === null ? null : toLiveSnapshot(liveDetail);
  const action = decidePriceReconcile(
    live ?? undefined,
    liveSnap ?? undefined,
    spec,
    productId
  );

  if (action === 'noop' && live !== null) {
    console.log(`[${TAG}] price ${priceKey} (${spec.lookupKey}) unchanged`);
    return live.id;
  }

  if (
    live !== null &&
    liveSnap !== null &&
    !priceMatchesSpec(liveSnap, spec, productId)
  ) {
    await stripe.prices.update(live.id, { active: false });
    console.log(`[${TAG}] archived price ${live.id} (${spec.lookupKey})`);
  }

  const created = await stripe.prices.create({
    product: productId,
    unit_amount: spec.unitAmount,
    currency: spec.currency,
    recurring: {
      interval: spec.recurring.interval,
      ...(spec.recurring.trialPeriodDays === undefined
        ? {}
        : { trial_period_days: spec.recurring.trialPeriodDays }),
    },
    lookup_key: spec.lookupKey,
    transfer_lookup_key: live !== null,
    currency_options: currencyOptionsToSnake(spec.currencyOptions),
  });
  console.log(`[${TAG}] created price ${created.id} (${spec.lookupKey})`);
  return created.id;
}

export async function reconcileStripeCatalog(
  stripe: Stripe,
  spec: CatalogSpec
): Promise<CatalogSyncResult> {
  const products: Array<{ key: string; productId: string }> = [];
  const productIdsByKey: Record<string, string> = {};
  for (const [productKey, def] of Object.entries(spec.products)) {
    const p = await ensureProduct(stripe, def);
    productIdsByKey[productKey] = p.id;
    products.push({ key: productKey, productId: p.id });
  }

  const prices: Array<{ key: string; priceId: string }> = [];
  for (const [priceKey, priceSpec] of Object.entries(spec.prices)) {
    const productId = productIdsByKey[priceSpec.product];
    if (productId === undefined) {
      throw new Error(
        `[${TAG}] unknown product ref "${priceSpec.product}" for price ${priceKey}`
      );
    }
    const priceId = await reconcileOnePrice({
      stripe,
      priceKey,
      spec: priceSpec,
      productId,
    });
    prices.push({ key: priceKey, priceId });
  }

  return { products, prices };
}
