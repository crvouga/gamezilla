/**
 * Vendor-neutral catalog types — product offerings and sync results.
 */

export type CurrencyOptionSpec = { readonly unitAmount: number };

export type ProductSpec = {
  readonly catalogProductId: string;
  readonly name: string;
  readonly description: string;
};

export type PriceSpec = {
  readonly product: string;
  readonly lookupKey: string;
  readonly unitAmount: number;
  readonly currency: string;
  readonly recurring: {
    readonly interval: 'month' | 'year';
    /** Default trial length in days when the provider supports plan trials. */
    readonly trialPeriodDays?: number;
  };
  readonly currencyOptions: Record<string, CurrencyOptionSpec>;
};

export type CatalogSpec = {
  readonly products: Readonly<Record<string, ProductSpec>>;
  readonly prices: Readonly<Record<string, PriceSpec>>;
};

export type CatalogProductSyncEntry = {
  readonly key: string;
  readonly productId: string;
};

export type CatalogPriceSyncEntry = {
  readonly key: string;
  readonly priceId: string;
};

export type CatalogSyncResult = {
  readonly products: ReadonlyArray<CatalogProductSyncEntry>;
  readonly prices: ReadonlyArray<CatalogPriceSyncEntry>;
};
