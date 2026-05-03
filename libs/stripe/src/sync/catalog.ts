/**
 * Catalog reconcile: declarative {@link STRIPE_CATALOG_SPEC} → Stripe Products/Prices.
 *
 * Pure orchestration — no secret resolution, no SQL connection setup. Callers
 * pass a ready-to-use Stripe client and (optionally) a PatchesDb to dump
 * `products.retrieve` / `prices.retrieve` payloads into.
 *
 * Idempotent: identifies products by `metadata.catalog_product_id` and prices
 * by `lookup_key`; archives drifted prices and recreates with `transfer_lookup_key`.
 */
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import Stripe from 'stripe';
import { STRIPE_PATCH_DB_SCRIPT_CONTEXT } from '../stripe-script-patch-db';
import { STRIPE_CATALOG_SPEC } from '../catalog-spec';
import {
  decidePriceReconcile,
  priceMatchesSpec,
  type PriceSpecEntry,
  specCurrencyOptionsToStripe,
  stripePriceProductId,
} from '../catalog-sync-shared';
import {
  STRIPE_CATALOG_PRODUCT_METADATA_KEY,
  upsertCatalogPriceFromStripeApi,
  upsertCatalogProductFromStripeApi,
} from '../stripe-catalog-mirror';

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
  /** True iff the optional patch-db catalog dump ran (i.e. `patchDb` was provided). */
  readonly catalogDumped: boolean;
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
    recurring: { interval: spec.recurring.interval },
    lookup_key: spec.lookup_key,
    transfer_lookup_key: live !== null,
    currency_options: specCurrencyOptionsToStripe(spec.currency_options),
  });
  console.log(`[${TAG}] created price ${created.id} (${spec.lookup_key})`);
  return created.id;
}

async function reconcileAllProducts(
  stripe: Stripe
): Promise<{
  readonly entries: ReadonlyArray<CatalogProductSyncEntry>;
  readonly stripeIdsByKey: Readonly<Record<string, string>>;
}> {
  const entries: CatalogProductSyncEntry[] = [];
  const stripeIdsByKey: Record<string, string> = {};
  for (const [productKey, def] of Object.entries(STRIPE_CATALOG_SPEC.products)) {
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

async function dumpCatalogToPatchDb(args: {
  readonly stripe: Stripe;
  readonly patchDb: PatchesDb;
  readonly productStripeIdsByKey: Readonly<Record<string, string>>;
  readonly priceStripeIdsByKey: Readonly<Record<string, string>>;
}): Promise<void> {
  const { stripe, patchDb, productStripeIdsByKey, priceStripeIdsByKey } = args;
  const ctx = STRIPE_PATCH_DB_SCRIPT_CONTEXT;

  for (const [specKey, def] of Object.entries(STRIPE_CATALOG_SPEC.products)) {
    const stripeProductId = productStripeIdsByKey[specKey];
    if (stripeProductId === undefined || stripeProductId.length === 0) {
      throw new Error(
        `[${TAG}] internal: missing stripe product id for "${specKey}"`
      );
    }
    const product = await stripe.products.retrieve(stripeProductId);
    await upsertCatalogProductFromStripeApi(
      patchDb,
      ctx,
      def.catalogProductId,
      product
    );
  }

  for (const [priceKey, stripePriceId] of Object.entries(priceStripeIdsByKey)) {
    const price = await stripe.prices.retrieve(stripePriceId, {
      expand: ['currency_options'],
    });
    await upsertCatalogPriceFromStripeApi(patchDb, ctx, priceKey, price);
  }

  console.log(
    `[${TAG}] dumped Stripe API product/price payloads to patch-db (stripe.catalog_* entities)`
  );
}

/**
 * Reconcile Stripe Products/Prices to match {@link STRIPE_CATALOG_SPEC}, then
 * (optionally) dump the resulting Stripe API payloads into `patchDb` so the
 * API Worker can resolve `priceKey` → Stripe price id without hitting Stripe.
 */
export async function runStripeCatalogSync(args: {
  readonly stripe: Stripe;
  /** When provided, dumps `products.retrieve` / `prices.retrieve` JSON into patch-db. */
  readonly patchDb?: PatchesDb;
}): Promise<CatalogSyncResult> {
  const { stripe, patchDb } = args;

  const { entries: products, stripeIdsByKey: productIdsByKey } =
    await reconcileAllProducts(stripe);
  const { entries: prices, stripeIdsByKey: priceIdsByKey } =
    await reconcileAllPrices(stripe, productIdsByKey);

  if (patchDb === undefined) {
    console.log(`[${TAG}] skip patch-db catalog dump — no patch-db provided`);
    return { products, prices, catalogDumped: false };
  }

  await dumpCatalogToPatchDb({
    stripe,
    patchDb,
    productStripeIdsByKey: productIdsByKey,
    priceStripeIdsByKey: priceIdsByKey,
  });

  return { products, prices, catalogDumped: true };
}
