import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client-ts/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared-ts/client-request-auth';
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import { providerUrlFrom } from './billing-request-error';

export type SubscribeArgs = {
  readonly returnUrl: string;
};

/**
 * Starts a checkout session and returns the provider URL to open. A refusal
 * throws a `BillingRequestError` saying why.
 */
export function useSubscribe(): (args: SubscribeArgs) => Promise<string> {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const { fetch: fetchFn } = useHttpClient();
  return async (args: SubscribeArgs): Promise<string> => {
    const base = config.getApiUrl().replace(/\/$/, '');
    const res = await fetchFn(`${base}/api/billing/checkout`, {
      method: 'POST',
      headers: clientAuthHeaders(auth, { requireAccountIdForBearer: true }),
      body: JSON.stringify(args),
    });
    return await providerUrlFrom(res, 'checkout');
  };
}
