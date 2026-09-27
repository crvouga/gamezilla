import { useConfigService } from '@libs/auth/public/config-service-context';
import {
  clientAuthHeaders,
  useClientRequestAuth,
} from '@libs/auth/public/use-client-request-auth';
import { useHttpClient } from '@pkgs/http-client/solid';

export type SubscribeArgs = {
  readonly returnUrl: string;
};

/** Starts a checkout session and returns the provider URL to open. */
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
    if (!res.ok) {
      throw new Error(`billing checkout failed (${String(res.status)})`);
    }
    const body = (await res.json()) as { url?: unknown };
    if (typeof body.url !== 'string' || body.url.length === 0) {
      throw new Error('billing checkout returned no url');
    }
    return body.url;
  };
}
