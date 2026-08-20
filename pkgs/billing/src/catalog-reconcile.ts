/**
 * Pure helpers for catalog price reconcile — unit-tested without network.
 */

import type { CurrencyOptionSpec, PriceSpec } from './catalog';

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

/** Snake_case wire shape used by some providers for currency_options. */
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
  spec: Record<string, CurrencyOptionSpec>
): Record<string, { unit_amount: number }> {
  const out: Record<string, { unit_amount: number }> = {};
  for (const [k, v] of Object.entries(spec)) {
    out[k.toLowerCase()] = { unit_amount: v.unitAmount };
  }
  return out;
}

function specCurrencyAmountMap(spec: PriceSpec): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(spec.currencyOptions)) {
    out[k.toLowerCase()] = v.unitAmount;
  }
  return out;
}

/**
 * Declarative spec is the source of truth: every spec currency must match live.
 * Providers may attach extra currency options; those must not force a replace.
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
    typeof (product as { id: unknown }).id === 'string'
  ) {
    return (product as { id: string }).id;
  }
  return null;
}

function recurringMatchesSpec(
  live: {
    interval: string;
    trialPeriodDays?: number | null;
  } | null,
  spec: PriceSpec['recurring']
): boolean {
  if (live?.interval !== spec.interval) return false;
  const specTrial = spec.trialPeriodDays ?? null;
  const liveTrial = live.trialPeriodDays ?? null;
  return specTrial === liveTrial;
}

export type LivePriceSnapshot = {
  readonly unitAmount: number | null;
  readonly currency: string;
  readonly recurring: {
    readonly interval: string;
    readonly trialPeriodDays?: number | null;
  } | null;
  readonly active: boolean;
  readonly product?: string | { id: string } | null;
  readonly currencyOptions?: Record<
    string,
    { unitAmount?: number | null }
  > | null;
};

export function priceMatchesSpec(
  live: LivePriceSnapshot,
  spec: PriceSpec,
  expectedProductId: string
): boolean {
  if (!live.active) return false;
  const pid = priceProductId(live.product ?? null);
  if (pid !== expectedProductId) return false;
  if (live.unitAmount !== spec.unitAmount) return false;
  if (live.currency?.toLowerCase() !== spec.currency.toLowerCase())
    return false;
  if (!recurringMatchesSpec(live.recurring, spec.recurring)) return false;
  const liveCo = normalizeCurrencyOptions(live.currencyOptions ?? undefined);
  const specCo = specCurrencyAmountMap(spec);
  return specCurrencyOptionsMatchLive(specCo, liveCo);
}

export type PriceReconcileAction = 'noop' | 'replace';

export function decidePriceReconcile(
  live: { id: string } | null | undefined,
  liveDetail: LivePriceSnapshot | null | undefined,
  spec: PriceSpec,
  expectedProductId: string
): PriceReconcileAction {
  if (
    live === undefined ||
    live === null ||
    liveDetail === undefined ||
    liveDetail === null
  ) {
    return 'replace';
  }
  if (priceMatchesSpec(liveDetail, spec, expectedProductId)) return 'noop';
  return 'replace';
}
