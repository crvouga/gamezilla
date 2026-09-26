/**
 * The catalog as provider prices. Seeded at boot from the catalog the host
 * hands the provider (the mock's `billing:sync`); ids derive from lookup
 * keys, so a file-backed provider keeps the same ids across restarts.
 */
import type {
  MockBillingCatalog,
  MockBillingCatalogPrice,
} from '@pkgs/billing-mock/catalog';
import type { MockPrice } from '@pkgs/billing-mock/wire';

import { invalidRequest, resourceMissing } from '../errors';
import type { ProviderDb } from '../store';
import type { Engine } from './context';

/** Prices are not owned by a customer. */
const CATALOG_OWNER = '';

function priceId(lookupKey: string): string {
  return `price_${lookupKey.replaceAll(/[^A-Za-z0-9]/g, '')}`;
}

function toPrice(
  catalog: MockBillingCatalog,
  spec: MockBillingCatalogPrice,
  createdS: number
): MockPrice {
  return {
    id: priceId(spec.lookupKey),
    object: 'price',
    active: true,
    product: catalog.product.id,
    lookup_key: spec.lookupKey,
    nickname: spec.nickname,
    unit_amount: spec.unitAmount,
    currency: spec.currency,
    recurring: {
      interval: spec.interval,
      interval_count: 1,
      trial_period_days: spec.trialPeriodDays,
    },
    created: createdS,
  };
}

/** Writes the catalog's prices; a price no longer offered is archived. */
export async function seedCatalog(
  db: ProviderDb,
  catalog: MockBillingCatalog,
  createdS: number
): Promise<void> {
  const wanted = new Set(catalog.prices.map((spec) => priceId(spec.lookupKey)));
  for (const existing of await db.all<MockPrice>('price')) {
    if (!wanted.has(existing.id) && existing.active) {
      await db.put({ ...existing, active: false }, CATALOG_OWNER);
    }
  }
  for (const spec of catalog.prices) {
    const stored = await db.get<MockPrice>(priceId(spec.lookupKey), 'price');
    const next = toPrice(catalog, spec, stored?.created ?? createdS);
    await db.put(next, CATALOG_OWNER);
  }
}

export async function requirePrice(
  engine: Engine,
  id: string
): Promise<MockPrice> {
  const price = await engine.db.get<MockPrice>(id, 'price');
  if (price === null) throw resourceMissing('price', id);
  if (!price.active) {
    throw invalidRequest(`The price '${id}' is archived.`, 'price');
  }
  return price;
}

export async function pricesByLookupKeys(
  engine: Engine,
  lookupKeys: readonly string[]
): Promise<readonly MockPrice[]> {
  const prices = await engine.db.all<MockPrice>('price');
  return prices.filter(
    (price) =>
      price.active &&
      price.lookup_key !== null &&
      lookupKeys.includes(price.lookup_key)
  );
}

/** The prices the portal lets a customer switch between, in catalog order. */
export async function switchablePrices(
  engine: Engine
): Promise<readonly MockPrice[]> {
  const prices = await pricesByLookupKeys(
    engine,
    engine.deps.catalog.portal.switchableLookupKeys
  );
  const order = engine.deps.catalog.portal.switchableLookupKeys;
  return [...prices].sort(
    (a, b) =>
      order.indexOf(a.lookup_key ?? '') - order.indexOf(b.lookup_key ?? '')
  );
}

/**
 * The end of one billing interval that starts at `startS`: a calendar month
 * or year later, clamped to the month's last day (Jan 31 → Feb 28/29), as a
 * card network bills it.
 */
export function periodEndS(price: MockPrice, startS: number): number {
  const start = new Date(startS * 1000);
  const months = price.recurring.interval === 'year' ? 12 : 1;
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const end = Date.UTC(
    year,
    month,
    Math.min(start.getUTCDate(), lastDay),
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds()
  );
  return Math.floor(end / 1000);
}
