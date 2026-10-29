/**
 * Reconciles the plus membership offer onto Paddle: the product, one price
 * per offer price (trial and regional amounts included) and the webhook
 * destination. Idempotent — a second run changes nothing. Entities are found
 * by the custom data this package stamps on them, never by Paddle id, so a
 * fresh sandbox and live converge the same way.
 *
 * Paddle has no portal configuration API (the portal is configured in the
 * dashboard), so the offer's `portal` block does not apply here.
 */
import type {
  OfferPriceSpec,
  PlusMembershipOffer,
} from '@pkgs/billing-root-shared-ts/offer';
import type { Logger } from '@pkgs/logger-shared-ts/logger';

import { PADDLE_CALLBACK_EVENTS } from './callback-events';
import { PADDLE_CURRENCY_COUNTRIES } from './currency-countries';
import type { PaddleApi } from './paddle-api';
import type {
  PaddleNotificationSetting,
  PaddlePrice,
  PaddleProduct,
} from './wire';
import { PADDLE_CUSTOM_DATA } from './wire';

const TAG = 'paddle offer reconcile';

export type PaddleOfferReconcileContext = {
  /** Absolute URL Paddle must POST subscription callbacks to. */
  readonly callbackUrl: string;
  /** Paddle tax category for the product (default `standard`). */
  readonly taxCategory?: string;
};

export type PaddleOfferReconcileResult = {
  readonly productId: string;
  readonly prices: readonly {
    readonly key: string;
    readonly priceId: string;
  }[];
  readonly notificationSettingId: string;
  /**
   * Set only when the destination was created by this run: Paddle shows the
   * signing secret once. Store it as `PADDLE_WEBHOOK_SECRET`.
   */
  readonly newWebhookSecret: string | null;
  /** Offer currencies Paddle is not given (buyers there pay the base price). */
  readonly unpricedCurrencies: readonly string[];
};

type PriceBody = {
  readonly description: string;
  readonly name: string;
  readonly unit_price: {
    readonly amount: string;
    readonly currency_code: string;
  };
  readonly billing_cycle: {
    readonly interval: string;
    readonly frequency: number;
  };
  readonly trial_period: {
    readonly interval: 'day';
    readonly frequency: number;
  } | null;
  readonly unit_price_overrides: readonly {
    readonly country_codes: readonly string[];
    readonly unit_price: {
      readonly amount: string;
      readonly currency_code: string;
    };
  }[];
  readonly custom_data: Readonly<Record<string, string>>;
};

/** The Paddle price an offer price should be, and what it cannot carry. */
export function paddlePriceBody(
  offer: PlusMembershipOffer,
  spec: OfferPriceSpec
): { readonly body: PriceBody; readonly unpriced: readonly string[] } {
  const unpriced: string[] = [];
  const overrides: PriceBody['unit_price_overrides'][number][] = [];
  for (const [currency, option] of Object.entries(spec.currencyOptions).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
  )) {
    const countries = PADDLE_CURRENCY_COUNTRIES[currency];
    if (countries === undefined) {
      unpriced.push(currency);
      continue;
    }
    overrides.push({
      country_codes: countries,
      unit_price: {
        amount: String(option.unitAmount),
        currency_code: currency.toUpperCase(),
      },
    });
  }
  const trialDays = spec.trialPeriodDays ?? 0;
  return {
    body: {
      description: `${offer.product.name} (${spec.interval}ly)`,
      name: spec.key,
      unit_price: {
        amount: String(spec.unitAmount),
        currency_code: spec.currency.toUpperCase(),
      },
      billing_cycle: { interval: spec.interval, frequency: 1 },
      trial_period:
        trialDays > 0 ? { interval: 'day', frequency: trialDays } : null,
      unit_price_overrides: overrides,
      custom_data: { [PADDLE_CUSTOM_DATA.catalogPriceId]: spec.catalogPriceId },
    },
    unpriced,
  };
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The live price's fields that `PriceBody` sets, in the same shape. */
function livePriceBody(live: PaddlePrice): PriceBody {
  return {
    description: live.description,
    name: live.name ?? '',
    unit_price: live.unit_price,
    billing_cycle: live.billing_cycle ?? { interval: '', frequency: 0 },
    trial_period:
      live.trial_period === null
        ? null
        : { interval: 'day', frequency: live.trial_period.frequency },
    unit_price_overrides: live.unit_price_overrides.map((o) => ({
      country_codes: o.country_codes,
      unit_price: o.unit_price,
    })),
    custom_data: Object.fromEntries(
      Object.entries(live.custom_data ?? {}).map(([k, v]) => [k, String(v)])
    ),
  };
}

async function ensureProduct(args: {
  readonly api: PaddleApi;
  readonly offer: PlusMembershipOffer;
  readonly taxCategory: string;
  readonly log: Logger;
}): Promise<string> {
  const { api, offer, log } = args;
  const products = await api.list<PaddleProduct>(
    '/products?status=active&per_page=200'
  );
  const live = products.find(
    (p) =>
      p.custom_data?.[PADDLE_CUSTOM_DATA.catalogProductId] ===
      offer.product.catalogProductId
  );
  const wanted = {
    name: offer.product.name,
    description: offer.product.description,
  };
  if (live === undefined) {
    const created = await api.data<PaddleProduct>('POST', '/products', {
      ...wanted,
      tax_category: args.taxCategory,
      custom_data: {
        [PADDLE_CUSTOM_DATA.catalogProductId]: offer.product.catalogProductId,
      },
    });
    log.info(`[${TAG}] created product ${created.id}`);
    return created.id;
  }
  if (live.name !== wanted.name || live.description !== wanted.description) {
    await api.data<PaddleProduct>('PATCH', `/products/${live.id}`, wanted);
    log.info(`[${TAG}] updated product ${live.id}`);
  } else {
    log.info(`[${TAG}] product ${live.id} unchanged`);
  }
  return live.id;
}

async function reconcilePrice(args: {
  readonly api: PaddleApi;
  readonly productId: string;
  readonly live: readonly PaddlePrice[];
  readonly body: PriceBody;
  readonly log: Logger;
}): Promise<string> {
  const { api, body, log } = args;
  const catalogPriceId = body.custom_data[PADDLE_CUSTOM_DATA.catalogPriceId];
  const live = args.live.find(
    (p) => p.custom_data?.[PADDLE_CUSTOM_DATA.catalogPriceId] === catalogPriceId
  );
  // A billing cycle is not something to change under existing subscribers:
  // retire that price and start a new one.
  const cycleChanged =
    live !== undefined &&
    !sameJson(livePriceBody(live).billing_cycle, body.billing_cycle);
  if (live !== undefined && cycleChanged) {
    await api.data<PaddlePrice>('PATCH', `/prices/${live.id}`, {
      status: 'archived',
    });
    log.info(`[${TAG}] archived price ${live.id} (billing cycle changed)`);
  }
  if (live === undefined || cycleChanged) {
    const created = await api.data<PaddlePrice>('POST', '/prices', {
      ...body,
      product_id: args.productId,
    });
    log.info(
      `[${TAG}] created price ${created.id} (${String(catalogPriceId)})`
    );
    return created.id;
  }
  if (sameJson(livePriceBody(live), body)) {
    log.info(`[${TAG}] price ${live.id} unchanged`);
    return live.id;
  }
  // Paddle prices are mutable: amounts, trial and overrides update in place.
  const { billing_cycle: _cycle, ...patch } = body;
  await api.data<PaddlePrice>('PATCH', `/prices/${live.id}`, patch);
  log.info(`[${TAG}] updated price ${live.id}`);
  return live.id;
}

function eventNames(setting: PaddleNotificationSetting): readonly string[] {
  return setting.subscribed_events
    .map((e) => (typeof e === 'string' ? e : e.name))
    .sort();
}

async function reconcileNotificationSetting(args: {
  readonly api: PaddleApi;
  readonly callbackUrl: string;
  readonly description: string;
  readonly log: Logger;
}): Promise<{ readonly id: string; readonly secret: string | null }> {
  const { api, log } = args;
  const wantedEvents = [...PADDLE_CALLBACK_EVENTS].sort();
  const settings = await api.data<readonly PaddleNotificationSetting[]>(
    'GET',
    '/notification-settings'
  );
  // Ours is the one at the callback URL, else the one we described: a moved
  // callback path moves the destination and keeps its signing secret.
  const live =
    settings.find((s) => s.destination === args.callbackUrl) ??
    settings.find((s) => s.description === args.description);
  if (live === undefined) {
    const created = await api.data<PaddleNotificationSetting>(
      'POST',
      '/notification-settings',
      {
        description: args.description,
        type: 'url',
        destination: args.callbackUrl,
        subscribed_events: wantedEvents,
        api_version: 1,
        traffic_source: 'platform',
      }
    );
    log.info(`[${TAG}] created notification destination ${created.id}`);
    return { id: created.id, secret: created.endpoint_secret_key ?? null };
  }
  const drift =
    live.destination !== args.callbackUrl ||
    live.description !== args.description ||
    !live.active ||
    !sameJson(eventNames(live), wantedEvents);
  if (!drift) {
    log.info(`[${TAG}] notification destination ${live.id} unchanged`);
    return { id: live.id, secret: null };
  }
  await api.data<PaddleNotificationSetting>(
    'PATCH',
    `/notification-settings/${live.id}`,
    {
      description: args.description,
      destination: args.callbackUrl,
      subscribed_events: wantedEvents,
      active: true,
    }
  );
  log.info(`[${TAG}] updated notification destination ${live.id}`);
  return { id: live.id, secret: null };
}

export async function reconcilePaddleOffer(
  api: PaddleApi,
  offer: PlusMembershipOffer,
  ctx: PaddleOfferReconcileContext,
  log: Logger
): Promise<PaddleOfferReconcileResult> {
  const productId = await ensureProduct({
    api,
    offer,
    taxCategory: ctx.taxCategory ?? 'standard',
    log,
  });
  const live = await api.list<PaddlePrice>(
    `/prices?product_id=${encodeURIComponent(productId)}&status=active&per_page=200`
  );
  const prices: { key: string; priceId: string }[] = [];
  const unpriced = new Set<string>();
  for (const [key, spec] of Object.entries(offer.prices)) {
    const { body, unpriced: missing } = paddlePriceBody(offer, spec);
    for (const currency of missing) unpriced.add(currency);
    prices.push({
      key,
      priceId: await reconcilePrice({ api, productId, live, body, log }),
    });
  }
  if (unpriced.size > 0) {
    log.warn(
      `[${TAG}] no Paddle countries for ${[...unpriced].sort().join(', ')}; those buyers pay the base price`
    );
  }
  const destination = await reconcileNotificationSetting({
    api,
    callbackUrl: ctx.callbackUrl,
    description: offer.callbackDescription,
    log,
  });
  if (destination.secret !== null) {
    log.warn(
      `[${TAG}] new notification destination: store its endpoint secret as PADDLE_WEBHOOK_SECRET`
    );
  }
  return {
    productId,
    prices,
    notificationSettingId: destination.id,
    newWebhookSecret: destination.secret,
    unpricedCurrencies: [...unpriced].sort(),
  };
}
