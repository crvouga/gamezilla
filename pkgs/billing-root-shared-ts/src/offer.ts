/**
 * What we sell, in our words. Deployment data every provider is configured
 * from — never a provider's vocabulary; each provider package translates it
 * into its own catalog (`reconcile` on its provider module).
 */

/** Why a member cancels — the choices a provider's portal may offer. */
export type CancellationReason =
  | 'too_expensive'
  | 'missing_features'
  | 'switched_service'
  | 'unused'
  | 'customer_service'
  | 'too_complex'
  | 'low_quality'
  | 'other';

export type OfferPriceSpec = {
  /** Our key for the price (`MembershipChange.offerPriceKey`). */
  readonly key: string;
  /**
   * The stable handle a provider's catalog finds this price by. Unique in the
   * offer; give a price a new handle to make providers mint a new price.
   */
  readonly catalogPriceId: string;
  /** Integer minor units of `currency`. */
  readonly unitAmount: number;
  /** Lowercase ISO 4217 code. */
  readonly currency: string;
  readonly interval: 'month' | 'year';
  readonly trialPeriodDays?: number;
  /** Regional prices, by lowercase currency code, in its minor units. */
  readonly currencyOptions: Readonly<
    Record<string, { readonly unitAmount: number }>
  >;
};

export type PlusMembershipOffer = {
  readonly product: {
    /** The stable handle a provider's catalog finds the product by. */
    readonly catalogProductId: string;
    readonly name: string;
    readonly description: string;
  };
  readonly prices: Readonly<Record<string, OfferPriceSpec>>;
  readonly defaultPriceKey: string;
  readonly switchablePriceKeys: readonly string[];
  /**
   * How the provider-hosted portal presents the membership. A provider that
   * configures its portal over its API applies all of it; one configured in
   * its own dashboard applies none — the offer asks, it does not assume.
   */
  readonly portal: {
    readonly defaultReturnUrlPath: string;
    readonly businessProfileHeadline: string;
    /** Empty means the portal asks for no reason. */
    readonly cancellationReasons: readonly CancellationReason[];
  };
  /** Callback paths are `<callbackPath>/<provider>`, below the API origin. */
  readonly callbackPath: string;
  /**
   * How a provider labels the webhook destination it posts callbacks to.
   * Reconcile finds the destination by its URL, else by this label (so a
   * moved `callbackPath` keeps its signing secret): keep it stable.
   */
  readonly callbackDescription: string;
};
