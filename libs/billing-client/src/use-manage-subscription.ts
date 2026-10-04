import { useConfigService } from '@libs/auth-client/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared/client-request-auth';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import { useHttpClient } from '@pkgs/http-client-client/solid';
import { useOpenExternalUrl } from '@pkgs/ui-client/external-url';

/** Opens the provider's hosted portal so the person can manage their plan. */
export function useManageSubscription(): () => Promise<void> {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const { fetch: fetchFn } = useHttpClient();
  const openExternalUrl = useOpenExternalUrl();
  return async (): Promise<void> => {
    const base = config.getApiUrl().replace(/\/$/, '');
    const returnUrl = `${window.location.origin}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`;
    const res = await fetchFn(`${base}/api/billing/portal`, {
      method: 'POST',
      headers: clientAuthHeaders(auth, { requireAccountIdForBearer: true }),
      body: JSON.stringify({ returnUrl }),
    });
    if (!res.ok) {
      throw new Error(`billing portal failed (${String(res.status)})`);
    }
    const body = (await res.json()) as { url?: unknown };
    if (typeof body.url !== 'string' || body.url.length === 0) {
      throw new Error('billing portal returned no url');
    }
    await openExternalUrl(body.url);
  };
}
