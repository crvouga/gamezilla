import { useConfigService } from '@libs/auth/public/config-service-context';
import { useClientRequestAuth } from '@libs/auth/public/use-client-request-auth';
import { useHttpClient } from '@pkgs/http-client/solid';

import type { CatalogPriceKey } from '../../shared/catalog/catalog-spec';
import { openPortal, startCheckout } from './billing-http';

export function useBillingHttp(): {
  readonly subscribe: (priceKey: CatalogPriceKey) => Promise<void>;
  readonly manage: () => Promise<void>;
} {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const { fetch: fetchFn } = useHttpClient();
  const http = { config, auth, fetchFn };
  return {
    subscribe: (priceKey) => startCheckout(http, priceKey),
    manage: () => openPortal(http),
  };
}
