/**
 * Pure helpers for Stripe price sync — unit-tested without network.
 */

export type CurrencyOptionSpec = { readonly unit_amount: number };

export type PriceSpecEntry = {
  readonly product: string;
  readonly lookup_key: string;
  readonly unit_amount: number;
  readonly currency: string;
  readonly recurring: { readonly interval: 'month' | 'year' };
  readonly currency_options: Record<string, CurrencyOptionSpec>;
};

/** Stripe returns snake_case currency keys; normalize for comparison. */
export function normalizeCurrencyOptions(
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

export function specCurrencyOptionsToStripe(
  spec: Record<string, CurrencyOptionSpec>
): Record<string, { unit_amount: number }> {
  const out: Record<string, { unit_amount: number }> = {};
  for (const [k, v] of Object.entries(spec)) {
    out[k.toLowerCase()] = { unit_amount: v.unit_amount };
  }
  return out;
}

function specCurrencyAmountMap(spec: PriceSpecEntry): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(spec.currency_options)) {
    out[k.toLowerCase()] = v.unit_amount;
  }
  return out;
}

/**
 * Declarative spec is the source of truth: every spec currency must match live.
 * Stripe may attach extra `currency_options` (e.g. defaults); those must not
 * force a replace loop.
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

export function stripePriceProductId(product: unknown): string | null {
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

export function priceMatchesSpec(
  live: {
    unit_amount: number | null;
    currency: string;
    recurring: { interval: string } | null;
    active: boolean;
    product?: string | { id: string } | null;
    currency_options?: Record<string, { unit_amount?: number | null }> | null;
  },
  spec: PriceSpecEntry,
  expectedProductStripeId: string
): boolean {
  if (!live.active) return false;
  const pid = stripePriceProductId(live.product ?? null);
  if (pid !== expectedProductStripeId) return false;
  if (live.unit_amount !== spec.unit_amount) return false;
  if (live.currency?.toLowerCase() !== spec.currency.toLowerCase()) return false;
  if (live.recurring?.interval !== spec.recurring.interval) return false;
  const liveCo = normalizeCurrencyOptions(live.currency_options ?? undefined);
  const specCo = specCurrencyAmountMap(spec);
  return specCurrencyOptionsMatchLive(specCo, liveCo);
}

export type PriceReconcileAction = 'noop' | 'replace';

export function decidePriceReconcile(
  live: { id: string } | null | undefined,
  liveDetail:
    | {
        unit_amount: number | null;
        currency: string;
        recurring: { interval: string } | null;
        active: boolean;
        product?: string | { id: string } | null;
        currency_options?: Record<string, { unit_amount?: number | null }> | null;
      }
    | null
    | undefined,
  spec: PriceSpecEntry,
  expectedProductStripeId: string
): PriceReconcileAction {
  if (live === undefined || live === null || liveDetail === undefined || liveDetail === null) {
    return 'replace';
  }
  if (priceMatchesSpec(liveDetail, spec, expectedProductStripeId)) return 'noop';
  return 'replace';
}
