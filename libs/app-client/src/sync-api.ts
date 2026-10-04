import type { ConfigService } from '@libs/auth-shared/config-service-types';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import { createSyncHttpClient, } from '@pkgs/sync-engine-client/sync-http-client';
import type { GetFreshAuthToken, SyncClientAuth, SyncHttpFetch } from '@pkgs/sync-engine-client/sync-http-client';
import type { MutationUploadResult, MutationUploadRow } from '@pkgs/sync-engine-client/mutation-upload-queue';
import type { QueryRequest } from '@pkgs/sync-engine-client/subscription-runtime';
import type { QueryResponse } from '@pkgs/sync-engine-shared/v2';
export type SyncApiFetch = SyncHttpFetch;

function httpClient(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly clock: Clock;
  readonly timers: Timers;
}) {
  return createSyncHttpClient({
    getBaseUrl: () => args.config.getApiUrl(),
    fetchFn: args.fetchFn,
    auth: args.auth,
    getFreshAuthToken: args.getFreshAuthToken,
    now: args.clock.now,
    timers: args.timers,
  });
}

export async function postAppQueries(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly requests: readonly QueryRequest[];
}): Promise<readonly QueryResponse[]> {
  return httpClient(args).postQueries(args.requests);
}

export async function postMutationBatch(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly mutations: readonly MutationUploadRow[];
}): Promise<MutationUploadResult> {
  return httpClient(args).postMutations(args.mutations);
}
