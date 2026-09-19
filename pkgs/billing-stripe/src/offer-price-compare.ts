/**
 * Pure comparison helpers for the offer price reconcile — unit-tested without
 * network.
 */
import type { OfferPriceSpec } from '@pkgs/billing';

/** Provider/live currency options may use snake_case keys; normalize. */
export function normalizeCurrencyOptions(
  raw: Record<string, { unitAmount?: number | null }> | null | undefined
): Record<string, number> {
  if (raw === null || raw === undefined) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v?.unitAmount === 'number') {
      out[k.toLowerCase()] = v.unitAmount;
    }
  }
  return out;
}

/** Snake_case wire shape used by Stripe for currency_options. */
export function normalizeSnakeCurrencyOptions(
  raw: Record<string, { unit_amount?: number | null }> | null | undefined
): Record<string, number> {
  if (raw === null || raw === undefined) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v?.unit_amount === 'number') {
      out[k.toLowerCase()] = v.unit_amount;
    }
  }
  return out;
}

export function currencyOptionsToSnake(
  spec: Readonly<Record<string, { readonly unitAmount: number }>>
): Record<string, { unit_amount: number }> {
  const out: Record<string, { unit_amount: number }> = {};
  for (const [k, v] of Object.entries(spec)) {
    out[k.toLowerCase()] = { unit_amount: v.unitAmount };
  }
  return out;
}

function specCurrencyAmountMap(spec: OfferPriceSpec): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(spec.currencyOptions)) {
    out[k.toLowerCase()] = v.unitAmount;
  }
  return out;
}

/**
 * The offer is the source of truth: every offer currency must match live.
 * Stripe may attach extra currency options; those must not force a replace.
 */
function specCurrencyOptionsMatchLive(
  spec: Record<string, number>,
  live: Record<string, number>
): boolean {
  for (const [k, v] of Object.entries(spec)) {
    if (live[k] !== v) return false;
  }
  return true;
}
export function priceProductId(product: unknown): string | null {
  if (typeof product === 'string') return product;
  if (
    product !== null &&
    typeof product === 'object' &&
    'id' in product &&
    typeof product.id === 'string'
  ) {
    return product.id;
  }
  return null;
}

export type LivePriceSnapshot = {
  readonly unitAmount: number | null;
  readonly currency: string;
  readonly interval: string | null;
  readonly trialPeriodDays: number | null;
  readonly active: boolean;
  readonly product?: string | { id: string } | null;
  readonly currencyOptions?: Record<
    string,
    { unitAmount?: number | null }
  > | null;
};

export function priceMatchesSpec(
  live: LivePriceSnapshot,
  spec: OfferPriceSpec,
  expectedProductId: string
): boolean {
  if (!live.active) return false;
  if (priceProductId(live.product ?? null) !== expectedProductId) return false;
  if (live.unitAmount !== spec.unitAmount) return false;
  if (live.currency?.toLowerCase() !== spec.currency.toLowerCase()) {
    return false;
  }
  if (live.interval !== spec.interval) return false;
  if ((live.trialPeriodDays ?? null) !== (spec.trialPeriodDays ?? null)) {
    return false;
  }
  const liveCo = normalizeCurrencyOptions(live.currencyOptions ?? undefined);
  return specCurrencyOptionsMatchLive(specCurrencyAmountMap(spec), liveCo);
}

export type PriceReconcileAction = 'noop' | 'replace';

export function decidePriceReconcile(
  live: { id: string } | null | undefined,
  liveDetail: LivePriceSnapshot | null | undefined,
  spec: OfferPriceSpec,
  expectedProductId: string
): PriceReconcileAction {
  if (live === undefined || live === null || !liveDetail) return 'replace';
  if (priceMatchesSpec(liveDetail, spec, expectedProductId)) return 'noop';
  return 'replace';
}
