import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client-ts/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared-ts/client-request-auth';
import type { ObservatoryRPC } from '@libs/observatory-server-ts/observatory-routes';
import type { OnlineNowFilter } from '@libs/observatory-shared-ts/live-session';
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { hc, type InferResponseType } from 'hono/client';

export function createObservatoryRpc(
  baseUrl: string,
  fetch: HttpFetch,
  headers: () => Record<string, string>
) {
  return hc<ObservatoryRPC>(
    `${baseUrl.replace(/\/$/, '')}/api/admin/observatory`,
    { fetch, headers }
  );
}
type Rpc = ReturnType<typeof createObservatoryRpc>;
/** Whoever is online now, as the User Observatory reads it. */
export type OnlineNowRead = InferResponseType<Rpc['live']['$get'], 200>;
export type OnlineNowEntryView = OnlineNowRead['entries'][number];
/** What a watcher sees of someone online now, or that they have left. */
export type LiveWatchRead = InferResponseType<
  Rpc['live'][':id']['watch']['$post'],
  200
>;

export function useObservatoryApi() {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  const rpc = createObservatoryRpc(config.getApiUrl(), http.fetch, () =>
    clientAuthHeaders(auth, { requireAccountIdForBearer: true })
  );
  return {
    async subscriptionCredentials() {
      const response = await rpc.subscription.$get();
      if (!response.ok) throw new Error('Observation permission is required.');
      return response.json();
    },
    async onlineNow(filter: OnlineNowFilter) {
      const response = await rpc.live.$get({ query: { filter } });
      if (!response.ok) throw new Error('Online now is unavailable.');
      return response.json();
    },
    async watch(sessionId: string) {
      const response = await rpc.live[':id'].watch.$post({
        param: { id: sessionId },
      });
      if (!response.ok) throw new Error('Watching live is unavailable.');
      return response.json();
    },
  };
}
