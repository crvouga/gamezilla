/**
 * Idempotent Stripe catalog sync: declarative SPEC → Stripe Products/Prices.
 * Optionally dumps raw Stripe API `products.retrieve` / `prices.retrieve` JSON into
 * EntityDb (`namespace: stripe`, types `catalog_price` / `catalog_product`) when
 * `DB_URL` from Doppler is a `postgres://` connection string (e.g. deploy).
 *
 * Secrets load via {@link createStripeScriptSecretStore} (`DOPPLER_TOKEN` or Doppler CLI login).
 */
import { SqlClientImplPostgresTcp } from '@gamezilla/lib/sql-client/impl-postgres-tcp';
import Stripe from 'stripe';
import {
  decidePriceReconcile,
  priceMatchesSpec,
  type PriceSpecEntry,
  specCurrencyOptionsToStripe,
  stripePriceProductId,
} from '../src/catalog-sync-shared';
import { createStripeScriptSecretStore } from '../src/script-secret-store';
import { StripeSecretKeys } from '../src/secret-keys';
import {
  STRIPE_CATALOG_PRODUCT_METADATA_KEY,
  upsertCatalogPriceFromStripeApi,
  upsertCatalogProductFromStripeApi,
} from '../src/stripe-catalog-mirror';
import { createStripeWebhookCacheEntityDb } from '../src/webhook-cache-entity-db';

const SPEC = {
  products: {
    subscription: {
      /** Value stored in Product metadata — durable identity in Stripe. */
      catalogProductId: 'subscription',
      name: 'Plus',
      description: 'Full access to Gamezilla.',
    },
  },
  prices: {
    subscription_monthly: {
      product: 'subscription',
      lookup_key: 'subscription_monthly',
      unit_amount: 700,
      currency: 'usd',
      recurring: { interval: 'month' as const },
      currency_options: {
        inr: { unit_amount: 29_900 },
        brl: { unit_amount: 1990 },
        ngn: { unit_amount: 599_000 },
        zar: { unit_amount: 12_900 },
        kes: { unit_amount: 90_000 },
      },
    },
    subscription_yearly: {
      product: 'subscription',
      lookup_key: 'subscription_yearly',
      unit_amount: 4999,
      currency: 'usd',
      recurring: { interval: 'year' as const },
      currency_options: {
        inr: { unit_amount: 299_900 },
        brl: { unit_amount: 19_900 },
        ngn: { unit_amount: 5_990_000 },
        zar: { unit_amount: 129_000 },
        kes: { unit_amount: 900_000 },
      },
    },
  },
} as const satisfies {
  readonly products: Record<
    string,
    {
      readonly catalogProductId: string;
      readonly name: string;
      readonly description: string;
    }
  >;
  readonly prices: Record<string, PriceSpecEntry>;
};

async function assertStripeKey(): Promise<string> {
  const store = createStripeScriptSecretStore();
  const key = await store.getOptional(StripeSecretKeys.secretKey);
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (trimmed.length === 0) {
    console.error(
      '[stripe sync] STRIPE_SECRET_KEY is missing or blank in Doppler (set DOPPLER_TOKEN or `doppler login`)'
    );
    process.exit(1);
  }
  return trimmed;
}

async function resolvePostgresUrl(): Promise<string | undefined> {
  const store = createStripeScriptSecretStore();
  const raw = (await store.getOptional('DB_URL')) ?? '';
  const u = raw.trim();
  if (u.length === 0) return undefined;
  if (u.startsWith('postgres://') || u.startsWith('postgresql://')) {
    return u;
  }
  return undefined;
}

/**
 * List active products and match `catalog_product_id` metadata (Search API is
 * not used — it can miss rows and caused duplicate Products on every sync).
 */
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
      `[stripe sync] ${matches.length} active products share ${STRIPE_CATALOG_PRODUCT_METADATA_KEY}=${catalogProductId} — using ${chosen.id} (oldest). Archive extras in Stripe Dashboard if needed.`
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
      `[stripe sync] archived orphan price ${p.id} (${lookupKey} on ${pid}, canonical product is ${canonicalProductId})`
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
        `[stripe sync] updated product ${existing.id} (${STRIPE_CATALOG_PRODUCT_METADATA_KEY}=${def.catalogProductId})`
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
    `[stripe sync] created product ${created.id} (${STRIPE_CATALOG_PRODUCT_METADATA_KEY}=${def.catalogProductId})`
  );
  return created;
}

async function main(): Promise<void> {
  const secret = await assertStripeKey();
  const stripe = new Stripe(secret);

  const productIds: Record<string, string> = {};

  for (const [productKey, def] of Object.entries(SPEC.products)) {
    const p = await ensureProduct(stripe, def);
    productIds[productKey] = p.id;
  }

  const priceIds: Record<string, string> = {};

  for (const [priceKey, spec] of Object.entries(SPEC.prices)) {
    const productStripeId = productIds[spec.product];
    if (productStripeId === undefined) {
      throw new Error(
        `Unknown product ref "${spec.product}" for price ${priceKey}`
      );
    }

    await archiveOrphanPricesForLookup(
      stripe,
      spec.lookup_key,
      productStripeId
    );

    const listed = await stripe.prices.list({
      lookup_keys: [spec.lookup_key],
      active: true,
      limit: 20,
    });
    const live =
      listed.data.find(
        (p) =>
          p.lookup_key === spec.lookup_key &&
          stripePriceProductId(p.product) === productStripeId
      ) ?? null;
    const liveDetail =
      live !== null
        ? await stripe.prices.retrieve(live.id, {
            expand: ['currency_options'],
          })
        : null;

    const action = decidePriceReconcile(
      live ?? undefined,
      liveDetail ?? undefined,
      spec,
      productStripeId
    );

    if (action === 'noop' && live !== null) {
      priceIds[priceKey] = live.id;
      console.log(
        `[stripe sync] price ${priceKey} (${spec.lookup_key}) unchanged`
      );
      continue;
    }

    if (
      live !== null &&
      liveDetail !== null &&
      !priceMatchesSpec(liveDetail, spec, productStripeId)
    ) {
      await stripe.prices.update(live.id, { active: false });
      console.log(
        `[stripe sync] archived price ${live.id} (${spec.lookup_key})`
      );
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
    priceIds[priceKey] = created.id;
    console.log(
      `[stripe sync] created price ${created.id} (${spec.lookup_key})`
    );
  }

  const pgUrl = await resolvePostgresUrl();
  if (pgUrl === undefined) {
    console.log(
      '[stripe sync] skip entity-db catalog dump — set DB_URL in Doppler (postgres://…) to persist Stripe API payloads'
    );
    return;
  }

  const sql = SqlClientImplPostgresTcp.connect(pgUrl);
  try {
    const entityDb = createStripeWebhookCacheEntityDb(sql);

    for (const [specKey, def] of Object.entries(SPEC.products)) {
      const stripeProductId = productIds[specKey];
      if (stripeProductId === undefined || stripeProductId.length === 0) {
        throw new Error(
          `[stripe sync] internal: missing stripe product id for "${specKey}"`
        );
      }
      const product = await stripe.products.retrieve(stripeProductId);
      await upsertCatalogProductFromStripeApi(
        entityDb,
        def.catalogProductId,
        product
      );
    }

    for (const [priceKey, stripePriceId] of Object.entries(priceIds)) {
      const price = await stripe.prices.retrieve(stripePriceId, {
        expand: ['currency_options'],
      });
      await upsertCatalogPriceFromStripeApi(entityDb, priceKey, price);
    }

    console.log(
      '[stripe sync] dumped Stripe API product/price payloads to entity db (catalog_* rows)'
    );
  } finally {
    await sql.disconnect();
  }
}

await main().catch((e: unknown) => {
  console.error(
    '[stripe sync] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
