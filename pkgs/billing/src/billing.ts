import type { CatalogSpec, CatalogSyncResult } from './catalog';

export type CreatePortalSessionInput = {
  readonly customerId: string;
  readonly returnUrl: string;
};

export type PortalSession = {
  readonly id: string;
  readonly url: string;
};

/**
 * Application billing port. Vendor adapters implement this; sim uses
 * {@link InMemoryBilling}.
 */
export interface Billing {
  createPortalSession(input: CreatePortalSessionInput): Promise<PortalSession>;

  syncCatalog(spec: CatalogSpec): Promise<CatalogSyncResult>;
}
