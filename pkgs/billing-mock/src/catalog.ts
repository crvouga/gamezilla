/**
 * What the mock provider sells, derived from the app's offer — the mock's
 * counterpart of `reconcileStripeOffer`. Stripe gets the offer through
 * `billing:sync`; the mock provider is booted with it.
 */
import type { PlusMembershipOffer } from '@pkgs/billing';

export type MockBillingCatalogPrice = {
  readonly lookupKey: string;
  readonly nickname: string;
  readonly unitAmount: number;
  readonly currency: string;
  readonly interval: 'month' | 'year';
  readonly trialPeriodDays: number | null;
};

export type MockBillingCatalog = {
  /** The business name the hosted pages show. */
  readonly businessName: string;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly description: string;
  };
  readonly prices: readonly MockBillingCatalogPrice[];
  /** The portal's configuration: which prices a customer may switch between. */
  readonly portal: {
    readonly switchableLookupKeys: readonly string[];
    readonly cancellationReasons: readonly string[];
  };
};

export function mockBillingCatalogFromOffer(
  offer: PlusMembershipOffer
): MockBillingCatalog {
  return {
    businessName: offer.portal.businessProfileHeadline,
    product: {
      id: `prod_${offer.product.catalogProductId}`,
      name: offer.product.name,
      description: offer.product.description,
    },
    prices: Object.values(offer.prices).map((spec) => ({
      lookupKey: spec.lookupKey,
      nickname: spec.interval === 'year' ? 'Yearly' : 'Monthly',
      unitAmount: spec.unitAmount,
      currency: spec.currency,
      interval: spec.interval,
      trialPeriodDays: spec.trialPeriodDays ?? null,
    })),
    portal: {
      switchableLookupKeys: offer.switchablePriceKeys.flatMap((key) => {
        const spec = offer.prices[key];
        return spec === undefined ? [] : [spec.lookupKey];
      }),
      cancellationReasons: offer.portal.cancellationReasons,
    },
  };
}
