export type OfferPriceSpec = {
  readonly key: string;
  readonly lookupKey: string;
  readonly unitAmount: number;
  readonly currency: string;
  readonly interval: 'month' | 'year';
  readonly trialPeriodDays?: number;
  readonly currencyOptions: Readonly<
    Record<string, { readonly unitAmount: number }>
  >;
};

export type PlusMembershipOffer = {
  readonly product: {
    readonly catalogProductId: string;
    readonly name: string;
    readonly description: string;
  };
  readonly prices: Readonly<Record<string, OfferPriceSpec>>;
  readonly defaultPriceKey: string;
  readonly switchablePriceKeys: readonly string[];
  readonly portal: {
    readonly defaultReturnUrlPath: string;
    readonly businessProfileHeadline: string;
    readonly cancellationReasons: readonly string[];
  };
  readonly callbackPath: string;
};
