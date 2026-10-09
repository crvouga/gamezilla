import { useConfigService } from '@libs/auth-client/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared/client-request-auth';
import type { PopulationRPC } from '@libs/population-server/population-routes';
import type {
  PopulationCommand,
  PopulationConfig,
} from '@libs/population-shared/config';
import { useHttpClient } from '@pkgs/http-client-client/solid';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import { hc, type InferResponseType } from 'hono/client';

export function createPopulationRpc(
  baseUrl: string,
  fetch: HttpFetch,
  headers: () => Record<string, string>
) {
  return hc<PopulationRPC>(
    `${baseUrl.replace(/\/$/, '')}/api/admin/population`,
    { fetch, headers }
  );
}
type Rpc = ReturnType<typeof createPopulationRpc>;
export type PopulationOverview = InferResponseType<Rpc['index']['$get'], 200>;
export type SyntheticUserView = PopulationOverview['users'][number];
export type PopulationEventView = PopulationOverview['events'][number];
export type SyntheticUserDetail = InferResponseType<
  Rpc['users'][':id']['$get'],
  200
>['user'];

export function usePopulationApi() {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  const rpc = createPopulationRpc(config.getApiUrl(), http.fetch, () =>
    clientAuthHeaders(auth, { requireAccountIdForBearer: true })
  );
  return {
    async subscriptionCredentials() {
      const response = await rpc.subscription.$get();
      if (!response.ok) throw new Error('Observation permission is required.');
      return response.json();
    },
    async overview() {
      const response = await rpc.index.$get();
      if (!response.ok)
        throw new Error(`Bot Observatory unavailable (${response.status})`);
      return response.json();
    },
    async configure(value: PopulationConfig) {
      const response = await rpc.config.$put({ json: value });
      if (response.status !== 200)
        throw new Error(
          'Configuration could not be saved. Refresh and try again.'
        );
      return (await response.json()).config;
    },
    async inspect(id: string) {
      const response = await rpc.users[':id'].$get({ param: { id } });
      if (response.status !== 200)
        throw new Error('Synthetic User could not be inspected.');
      return (await response.json()).user;
    },
    async events(id: string) {
      const response = await rpc.users[':id'].events.$get({ param: { id } });
      if (!response.ok)
        throw new Error('Synthetic User events are unavailable.');
      return (await response.json()).events;
    },
    async replay(id: string) {
      const response = await rpc.users[':id'].replay.$post({ param: { id } });
      if (!response.ok) throw new Error('Decision replay is unavailable.');
      return response.json();
    },
    async command(id: string, value: PopulationCommand) {
      const response = await rpc.users[':id'].commands.$post({
        param: { id },
        json: value,
      });
      if (response.status !== 200)
        throw new Error('Command was not accepted. Refresh and try again.');
    },
  };
}
export type PopulationApi = ReturnType<typeof usePopulationApi>;
