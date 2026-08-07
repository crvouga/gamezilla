import type { ConfigService } from '@libs/auth/client/config-service-types';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from '@pkgs/sync-engine/client/mutation-upload-queue';
import type { QueryRequest } from '@pkgs/sync-engine/client/subscription-runtime';
import {
  createSyncHttpClient,
  type GetFreshAuthToken,
  SyncApiAuthError,
  type SyncClientAuth,
  type SyncHttpFetch,
} from '@pkgs/sync-engine/client/sync-http-client';
import type { QueryResponse } from '@pkgs/sync-engine/queries/core/types';

export type { GetFreshAuthToken, SyncClientAuth };
export type SyncApiFetch = SyncHttpFetch;
export { SyncApiAuthError };

function httpClient(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}) {
  return createSyncHttpClient({
    getBaseUrl: () => args.config.getApiUrl(),
    fetchFn: args.fetchFn,
    auth: args.auth,
    getFreshAuthToken: args.getFreshAuthToken,
  });
}

export async function postAppQueries(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly requests: readonly QueryRequest[];
}): Promise<readonly QueryResponse[]> {
  return httpClient(args).postQueries(args.requests);
}

export async function postMutationBatch(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
  readonly mutations: readonly MutationUploadRow[];
}): Promise<MutationUploadResult> {
  return httpClient(args).postMutations(args.mutations);
}
