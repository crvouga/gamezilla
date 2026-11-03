import type { ConfigService } from '@libs/auth-shared-ts/config-service-types';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import type { QueryRequest } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import type {
  GetFreshAuthToken,
  SyncClientAuth,
  SyncHttpFetch,
} from '@pkgs/sync-engine-client-ts/sync-http-client';
import { createSyncHttpClient } from '@pkgs/sync-engine-client-ts/sync-http-client';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';
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
