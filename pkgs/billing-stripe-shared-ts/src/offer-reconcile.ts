/**
 * Stripe offer reconcile — the offer is the source of truth for the product,
 * prices, the hosted portal configuration and the webhook endpoint.
 *
 * Identity at Stripe:
 *   - products by `metadata.catalog_product_id`
 *   - prices by `lookup_key`
 *   - portal configuration by `metadata.catalog_portal_configuration_id`
 *   - webhook endpoint by `url`
 */
import type {
  CancellationReason,
  OfferPriceSpec,
  PlusMembershipOffer,
} from '@pkgs/billing-root-shared-ts/offer';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type Stripe from 'stripe';

import { STRIPE_MEMBERSHIP_CALLBACK_EVENTS } from './callback-events';

type StripeCancellationReason =
  Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionCancel.CancellationReason.Option;

/** Our cancellation reasons in Stripe's words (the same words, today). */
const STRIPE_CANCELLATION_REASON: Readonly<
  Record<CancellationReason, StripeCancellationReason>
> = {
  too_expensive: 'too_expensive',
  missing_features: 'missing_features',
  switched_service: 'switched_service',
  unused: 'unused',
  customer_service: 'customer_service',
  too_complex: 'too_complex',
  low_quality: 'low_quality',
  other: 'other',
};

import type { LivePriceSnapshot } from './offer-price-compare';
import {
  currencyOptionsToSnake,
  decidePriceReconcile,
  normalizeSnakeCurrencyOptions,
  priceMatchesSpec,
  priceProductId,
} from './offer-price-compare';

/** Stripe product metadata key used to match the offer product id. */
export const STRIPE_CATALOG_PRODUCT_METADATA_KEY =
  'catalog_product_id' as const;
/** Stripe portal-configuration metadata key used to match our configuration. */
export const STRIPE_PORTAL_CONFIGURATION_METADATA_KEY =
  'catalog_portal_configuration_id' as const;
/** The single portal configuration this product manages. */
export const STRIPE_PORTAL_CONFIGURATION_ID = 'default' as const;

const TAG = 'stripe reconcile offer';

export type OfferReconcileContext = {
  /** Absolute URL the provider must POST subscription callbacks to. */
  readonly callbackUrl: string;
};

export type OfferReconcileResult = {
  readonly products: ReadonlyArray<{
    readonly key: string;
    readonly productId: string;
  }>;
  readonly prices: ReadonlyArray<{
    readonly key: string;
    readonly priceId: string;
  }>;
  readonly portalConfigurationId: string;
  readonly webhookEndpointId: string;
};

function toLiveSnapshot(price: Stripe.Price): LivePriceSnapshot {
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
    interval: price.recurring?.interval ?? null,
    trialPeriodDays: price.recurring?.trial_period_days ?? null,
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

async function ensureProduct(
  stripe: Stripe,
  offer: PlusMembershipOffer,
  log: Logger
): Promise<Stripe.Product> {
  const def = offer.product;
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
      log.info(
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
  log.info(
    `[${TAG}] created product ${created.id} (${STRIPE_CATALOG_PRODUCT_METADATA_KEY}=${def.catalogProductId})`
  );
  return created;
}

async function archiveOrphanPricesForLookup(
  stripe: Stripe,
  catalogPriceId: string,
  canonicalProductId: string,
  log: Logger
): Promise<void> {
  const listed = await stripe.prices.list({
    lookup_keys: [catalogPriceId],
    active: true,
    limit: 20,
  });
  for (const p of listed.data) {
    const pid = priceProductId(p.product);
    if (pid === null || pid === canonicalProductId) continue;
    await stripe.prices.update(p.id, { active: false });
    log.info(
      `[${TAG}] archived orphan price ${p.id} (${catalogPriceId} on ${pid}, canonical product is ${canonicalProductId})`
    );
  }
}

async function findLivePriceForLookup(
  stripe: Stripe,
  catalogPriceId: string,
  productId: string
): Promise<{
  readonly live: Stripe.Price | null;
  readonly liveDetail: Stripe.Price | null;
}> {
  const listed = await stripe.prices.list({
    lookup_keys: [catalogPriceId],
    active: true,
    limit: 20,
  });
  const live =
    listed.data.find(
      (p) =>
        p.lookup_key === catalogPriceId &&
        priceProductId(p.product) === productId
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
  readonly spec: OfferPriceSpec;
  readonly productId: string;
  readonly log: Logger;
}): Promise<string> {
  const { stripe, priceKey, spec, productId, log } = args;

  await archiveOrphanPricesForLookup(
    stripe,
    spec.catalogPriceId,
    productId,
    log
  );

  const { live, liveDetail } = await findLivePriceForLookup(
    stripe,
    spec.catalogPriceId,
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
    log.info(`[${TAG}] price ${priceKey} (${spec.catalogPriceId}) unchanged`);
    return live.id;
  }

  if (
    live !== null &&
    liveSnap !== null &&
    !priceMatchesSpec(liveSnap, spec, productId)
  ) {
    await stripe.prices.update(live.id, { active: false });
    log.info(`[${TAG}] archived price ${live.id} (${spec.catalogPriceId})`);
  }

  const created = await stripe.prices.create({
    product: productId,
    unit_amount: spec.unitAmount,
    currency: spec.currency,
    recurring: {
      interval: spec.interval,
      ...(spec.trialPeriodDays === undefined
        ? {}
        : { trial_period_days: spec.trialPeriodDays }),
    },
    lookup_key: spec.catalogPriceId,
    transfer_lookup_key: live !== null,
    currency_options: currencyOptionsToSnake(spec.currencyOptions),
  });
  log.info(`[${TAG}] created price ${created.id} (${spec.catalogPriceId})`);
  return created.id;
}

type PortalFeaturesParam =
  Stripe.BillingPortal.ConfigurationCreateParams['features'];

/**
 * A trial goes on when its plan changes in the portal; Stripe's default
 * (`end_trial`) ends it and bills at once. stripe-node types the setting from
 * 19.x (`2025-09-30.clover`); the API takes it at every version.
 */
const TRIAL_UPDATE_BEHAVIOR = 'continue_trial';

type WithTrialUpdateBehavior = {
  readonly trial_update_behavior?: string;
};

function portalFeaturesParam(
  offer: PlusMembershipOffer,
  productId: string,
  priceIdsByKey: Readonly<Record<string, string>>
): PortalFeaturesParam {
  const allowedPrices = offer.switchablePriceKeys
    .map((key) => priceIdsByKey[key])
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return {
    customer_update: { enabled: false, allowed_updates: [] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      proration_behavior: 'none',
      cancellation_reason: {
        enabled: offer.portal.cancellationReasons.length > 0,
        options: offer.portal.cancellationReasons.map(
          (reason) => STRIPE_CANCELLATION_REASON[reason]
        ),
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      trial_update_behavior: TRIAL_UPDATE_BEHAVIOR,
      ...(allowedPrices.length === 0
        ? {}
        : { products: [{ product: productId, prices: allowedPrices }] }),
    } as NonNullable<PortalFeaturesParam['subscription_update']> &
      WithTrialUpdateBehavior,
  };
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...a].sort();
  const wanted = [...b].sort();
  return sorted.every((value, index) => value === wanted[index]);
}

/** Stripe models "unset" as `''`; treat anything but an array as empty. */
function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? (value as readonly string[]) : [];
}

/** Prices of the first product in an (emptyable) `subscription_update.products`. */
function firstProductPrices(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const first = value[0] as { readonly prices?: unknown } | undefined;
  return stringList(first?.prices);
}

function featuresMatchLive(
  live: Stripe.BillingPortal.Configuration['features'],
  wanted: PortalFeaturesParam
): boolean {
  const wantedPrices = firstProductPrices(wanted.subscription_update?.products);
  const livePrices = firstProductPrices(live.subscription_update.products);
  const wantedCancelOptions = stringList(
    wanted.subscription_cancel?.cancellation_reason?.options
  );
  const liveCancelOptions = stringList(
    live.subscription_cancel.cancellation_reason?.options
  );
  return (
    live.customer_update.enabled === wanted.customer_update?.enabled &&
    live.invoice_history.enabled === wanted.invoice_history?.enabled &&
    live.payment_method_update.enabled ===
      wanted.payment_method_update?.enabled &&
    live.subscription_cancel.enabled === wanted.subscription_cancel?.enabled &&
    live.subscription_cancel.mode === wanted.subscription_cancel?.mode &&
    live.subscription_cancel.proration_behavior ===
      wanted.subscription_cancel?.proration_behavior &&
    live.subscription_update.enabled === wanted.subscription_update?.enabled &&
    live.subscription_update.proration_behavior ===
      wanted.subscription_update?.proration_behavior &&
    (live.subscription_update as WithTrialUpdateBehavior)
      .trial_update_behavior === TRIAL_UPDATE_BEHAVIOR &&
    sameStringSet(
      stringList(live.subscription_update.default_allowed_updates),
      stringList(wanted.subscription_update?.default_allowed_updates)
    ) &&
    sameStringSet(livePrices, wantedPrices) &&
    sameStringSet(liveCancelOptions, wantedCancelOptions)
  );
}

async function reconcilePortalConfiguration(args: {
  readonly stripe: Stripe;
  readonly offer: PlusMembershipOffer;
  readonly ctx: OfferReconcileContext;
  readonly productId: string;
  readonly priceIdsByKey: Readonly<Record<string, string>>;
  readonly log: Logger;
}): Promise<string> {
  const wanted = portalFeaturesParam(
    args.offer,
    args.productId,
    args.priceIdsByKey
  );
  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: args.offer.portal.businessProfileHeadline,
    },
    default_return_url: `${new URL(args.ctx.callbackUrl).origin}${args.offer.portal.defaultReturnUrlPath}`,
    features: wanted,
    metadata: {
      [STRIPE_PORTAL_CONFIGURATION_METADATA_KEY]:
        STRIPE_PORTAL_CONFIGURATION_ID,
    },
  };
  const listed = await args.stripe.billingPortal.configurations.list({
    active: true,
    limit: 100,
  });
  const live =
    listed.data.find(
      (configuration) =>
        configuration.metadata?.[STRIPE_PORTAL_CONFIGURATION_METADATA_KEY] ===
        STRIPE_PORTAL_CONFIGURATION_ID
    ) ?? null;
  if (live === null) {
    const created =
      await args.stripe.billingPortal.configurations.create(params);
    args.log.info(`[${TAG}] created portal configuration ${created.id}`);
    return created.id;
  }
  if (
    featuresMatchLive(live.features, wanted) &&
    live.default_return_url === params.default_return_url
  ) {
    args.log.info(`[${TAG}] portal configuration ${live.id} unchanged`);
    return live.id;
  }
  await args.stripe.billingPortal.configurations.update(live.id, params);
  args.log.info(`[${TAG}] updated portal configuration ${live.id}`);
  return live.id;
}

async function reconcileWebhookEndpoint(args: {
  readonly ctx: OfferReconcileContext;
  readonly description: string;
  readonly stripe: Stripe;
  readonly log: Logger;
}): Promise<string> {
  const wantedEvents = Object.keys(STRIPE_MEMBERSHIP_CALLBACK_EVENTS);
  const listed = await args.stripe.webhookEndpoints.list({ limit: 100 });
  // Ours is the one at the callback URL, else the one we described: when the
  // callback path moves, the endpoint moves with it and keeps its signing
  // secret, rather than a second endpoint appearing with a new one.
  const live =
    listed.data.find((e) => e.url === args.ctx.callbackUrl) ??
    listed.data.find((e) => e.description === args.description) ??
    null;
  if (live === null) {
    const created = await args.stripe.webhookEndpoints.create({
      url: args.ctx.callbackUrl,
      enabled_events:
        wantedEvents as unknown as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
      description: args.description,
    });
    args.log.info(`[${TAG}] created webhook endpoint ${created.id}`);
    return created.id;
  }
  const drift =
    live.url !== args.ctx.callbackUrl ||
    !sameStringSet(live.enabled_events, wantedEvents) ||
    live.description !== args.description ||
    live.status !== 'enabled';
  if (!drift) {
    args.log.info(`[${TAG}] webhook endpoint ${live.id} unchanged`);
    return live.id;
  }
  await args.stripe.webhookEndpoints.update(live.id, {
    url: args.ctx.callbackUrl,
    enabled_events:
      wantedEvents as unknown as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
    description: args.description,
    disabled: false,
  });
  args.log.info(`[${TAG}] updated webhook endpoint ${live.id}`);
  return live.id;
}

export async function reconcileStripeOffer(
  stripe: Stripe,
  offer: PlusMembershipOffer,
  ctx: OfferReconcileContext,
  log: Logger
): Promise<OfferReconcileResult> {
  const product = await ensureProduct(stripe, offer, log);

  const prices: Array<{ key: string; priceId: string }> = [];
  const priceIdsByKey: Record<string, string> = {};
  for (const [priceKey, spec] of Object.entries(offer.prices)) {
    const priceId = await reconcileOnePrice({
      stripe,
      priceKey,
      spec,
      productId: product.id,
      log,
    });
    prices.push({ key: priceKey, priceId });
    priceIdsByKey[priceKey] = priceId;
  }

  const portalConfigurationId = await reconcilePortalConfiguration({
    stripe,
    offer,
    ctx,
    productId: product.id,
    priceIdsByKey,
    log,
  });
  const webhookEndpointId = await reconcileWebhookEndpoint({
    stripe,
    ctx,
    description: offer.callbackDescription,
    log,
  });
  return {
    products: [{ key: offer.product.catalogProductId, productId: product.id }],
    prices,
    portalConfigurationId,
    webhookEndpointId,
  };
}
