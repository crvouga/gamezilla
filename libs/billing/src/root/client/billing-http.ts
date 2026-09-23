import {
  type ClientRequestAuth,
  clientAuthHeaders,
} from '@libs/auth/public/client-request-auth';
import type { ConfigService } from '@libs/auth/public/config-service-types';
import type { HttpClient } from '@pkgs/http-client';

import type { CatalogPriceKey } from '../../shared/catalog/catalog-spec';

export type BillingHttp = {
  readonly config: ConfigService;
  readonly auth: ClientRequestAuth;
  readonly fetchFn: HttpClient['fetch'];
};

function billingReturnUrl(): string {
  return `${window.location.origin}/more/billing`;
}

function readUrl(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null;
  const url = (body as Record<string, unknown>)['url'];
  return typeof url === 'string' && url.length > 0 ? url : null;
}

async function postBilling(
  http: BillingHttp,
  path: string,
  body: Record<string, string>
): Promise<void> {
  const response = await http.fetchFn(`${http.config.getApiUrl()}/api${path}`, {
    method: 'POST',
    headers: clientAuthHeaders(http.auth),
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  const url = readUrl(payload);
  if (!response.ok || url === null) {
    throw new Error(`billing ${path} failed (${response.status})`);
  }
  window.location.assign(url);
}

export function startCheckout(
  http: BillingHttp,
  priceKey: CatalogPriceKey
): Promise<void> {
  const returnUrl = billingReturnUrl();
  return postBilling(http, '/billing/checkout', {
    priceKey,
    successUrl: returnUrl,
    cancelUrl: returnUrl,
  });
}

export function openPortal(http: BillingHttp): Promise<void> {
  return postBilling(http, '/billing/portal', {
    returnUrl: billingReturnUrl(),
  });
}
