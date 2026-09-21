/**
 * Static checks on the offer, with no provider and no credentials.
 *
 * The billing gate used to *reconcile* the offer onto Stripe — the same call
 * `billing:sync` makes on deploy — which meant every pull request wrote the
 * live product catalogue, prices, portal configuration and webhook endpoint,
 * and needed production billing credentials to do it. That is a deploy action,
 * not a check, and it is why the gate could never be green without secrets.
 *
 * The reconcile still happens, on deploy, in `billing:sync`. What belongs in
 * the gate is this: the offer is the source of truth Stripe is reconciled
 * *from*, so the things that would produce a broken catalogue are worth
 * catching before anyone deploys — and every one of them is decidable from the
 * value alone.
 */
import type { PlusMembershipOffer } from '@pkgs/billing';

const CURRENCY = /^[a-z]{3}$/;

function isMinorUnits(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function checkPrices(offer: PlusMembershipOffer, out: string[]): void {
  const lookupKeys = new Map<string, string>();
  for (const [key, price] of Object.entries(offer.prices)) {
    const at = `prices.${key}`;
    if (price.key !== key) {
      out.push(`${at}: key is '${price.key}', but it is stored under '${key}'`);
    }
    const seen = lookupKeys.get(price.lookupKey);
    if (seen !== undefined) {
      out.push(
        `${at}: lookupKey '${price.lookupKey}' is already used by '${seen}' — the provider treats it as a unique handle`
      );
    }
    lookupKeys.set(price.lookupKey, key);
    if (!isMinorUnits(price.unitAmount)) {
      out.push(
        `${at}: unitAmount must be a positive integer in minor units, got ${String(price.unitAmount)}`
      );
    }
    if (!CURRENCY.test(price.currency)) {
      out.push(
        `${at}: currency must be a lowercase ISO code, got '${price.currency}'`
      );
    }
    if (
      price.trialPeriodDays !== undefined &&
      !Number.isInteger(price.trialPeriodDays)
    ) {
      out.push(`${at}: trialPeriodDays must be a whole number of days`);
    }
    checkCurrencyOptions(price.currency, price.currencyOptions, at, out);
  }
}

function checkCurrencyOptions(
  base: string,
  options: PlusMembershipOffer['prices'][string]['currencyOptions'],
  at: string,
  out: string[]
): void {
  for (const [code, option] of Object.entries(options)) {
    if (!CURRENCY.test(code)) {
      out.push(`${at}.currencyOptions: '${code}' is not a lowercase ISO code`);
    }
    if (code === base) {
      out.push(
        `${at}.currencyOptions: '${code}' repeats the price's own currency, which the provider rejects`
      );
    }
    if (!isMinorUnits(option.unitAmount)) {
      out.push(
        `${at}.currencyOptions.${code}: unitAmount must be a positive integer in minor units`
      );
    }
  }
}

function checkPaths(offer: PlusMembershipOffer, out: string[]): void {
  for (const [label, value] of [
    ['callbackPath', offer.callbackPath],
    ['portal.defaultReturnUrlPath', offer.portal.defaultReturnUrlPath],
  ] as const) {
    if (!value.startsWith('/')) {
      out.push(`${label}: must be an absolute path, got '${value}'`);
    }
    if (value.includes('://')) {
      out.push(`${label}: must be a path, not an origin — got '${value}'`);
    }
  }
}

/** Every problem with the offer, in report order. Empty means it is sound. */
export function validatePlusMembershipOffer(
  offer: PlusMembershipOffer
): readonly string[] {
  const out: string[] = [];
  const keys = Object.keys(offer.prices);
  if (keys.length === 0) out.push('prices: the offer sells nothing');
  if (!Object.hasOwn(offer.prices, offer.defaultPriceKey)) {
    out.push(
      `defaultPriceKey: '${offer.defaultPriceKey}' is not one of ${keys.join(', ') || '(none)'}`
    );
  }
  for (const key of offer.switchablePriceKeys) {
    if (!Object.hasOwn(offer.prices, key)) {
      out.push(`switchablePriceKeys: '${key}' is not a declared price`);
    }
  }
  if (!offer.switchablePriceKeys.includes(offer.defaultPriceKey)) {
    out.push(
      `switchablePriceKeys: must include the default '${offer.defaultPriceKey}', or nobody can switch back to it`
    );
  }
  if (offer.product.catalogProductId.length === 0) {
    out.push('product.catalogProductId: must not be empty');
  }
  if (offer.portal.cancellationReasons.length === 0) {
    out.push('portal.cancellationReasons: the provider requires at least one');
  }
  checkPrices(offer, out);
  checkPaths(offer, out);
  return out;
}
