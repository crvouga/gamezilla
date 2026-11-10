import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client-ts/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared-ts/client-request-auth';
import type { SyntheticPopulationRPC } from '@libs/synthetic-population-server-ts/synthetic-population-routes';
import type {
  SyntheticPopulationBulkCommand,
  SyntheticPopulationCommand,
  SyntheticPopulationConfig,
} from '@libs/synthetic-population-shared-ts/config';
import type { OnlineNowFilter } from '@libs/synthetic-population-shared-ts/live-session';
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { hc, type InferResponseType } from 'hono/client';

export function createSyntheticPopulationRpc(
  baseUrl: string,
  fetch: HttpFetch,
  headers: () => Record<string, string>
) {
  return hc<SyntheticPopulationRPC>(
    `${baseUrl.replace(/\/$/, '')}/api/admin/synthetic-population`,
    { fetch, headers }
  );
}
type Rpc = ReturnType<typeof createSyntheticPopulationRpc>;
export type SyntheticPopulationOverview = InferResponseType<
  Rpc['index']['$get'],
  200
>;
export type SyntheticUserView = SyntheticPopulationOverview['users'][number];
export type SyntheticPopulationEventView =
  SyntheticPopulationOverview['events'][number];
export type SyntheticUserDetail = InferResponseType<
  Rpc['users'][':id']['$get'],
  200
>['user'];
/** Whoever is online now, as the Bot Observatory reads it. */
export type OnlineNowRead = InferResponseType<Rpc['live']['$get'], 200>;
export type OnlineNowEntryView = OnlineNowRead['entries'][number];
/** What a watcher sees of someone online now, or that they have left. */
export type LiveWatchRead = InferResponseType<
  Rpc['live'][':id']['watch']['$post'],
  200
>;

export function useSyntheticPopulationApi() {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  const rpc = createSyntheticPopulationRpc(config.getApiUrl(), http.fetch, () =>
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
    async directory(q: string, cursor: string | null) {
      const response = await rpc.users.$get({
        query: { q, ...(cursor === null ? {} : { cursor }) },
      });
      if (!response.ok)
        throw new Error('Synthetic User directory is unavailable.');
      return response.json();
    },
    async configure(value: SyntheticPopulationConfig) {
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
    async commandAll(value: SyntheticPopulationBulkCommand) {
      const response = await rpc.commands.$post({ json: value });
      if (response.status !== 200)
        throw new Error('Command was not accepted. Refresh and try again.');
    },
    async command(id: string, value: SyntheticPopulationCommand) {
      const response = await rpc.users[':id'].commands.$post({
        param: { id },
        json: value,
      });
      if (response.status !== 200)
        throw new Error('Command was not accepted. Refresh and try again.');
    },
  };
}
export type SyntheticPopulationApi = ReturnType<
  typeof useSyntheticPopulationApi
>;
/** A decision replay's outcome, as the replay endpoint returns it. */
export type SyntheticUserReplayResult = Awaited<
  ReturnType<SyntheticPopulationApi['replay']>
>;
/** One page of the Synthetic User directory. */
export type SyntheticPopulationDirectoryPage = Awaited<
  ReturnType<SyntheticPopulationApi['directory']>
>;
