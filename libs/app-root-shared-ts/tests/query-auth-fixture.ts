import { resolveSessionReplayAuth } from '@libs/app-root-shared-ts/query-auth';
import {
  type ApiRequestAsyncStore,
  apiRequestAsyncLocalStorage,
} from '@libs/app-root-shared-ts/request-scope';

export const DEVICE = 'f362fe7c-d338-4893-b6f9-6654cc3b746d';

export function resolveWith(
  resolveAuthContext: () => Promise<Readonly<Record<string, unknown>>>,
  headers: HeadersInit = {
    authorization: 'Bearer valid-session',
    'x-anon-id': DEVICE,
  }
) {
  // This resolver consumes only the request's authentication port and SQL
  // reference. Unrelated request resources are intentionally absent.
  const store = {
    sessionAuth: { resolveAuthContext },
    sqlClient: {},
  } as unknown as ApiRequestAsyncStore;
  return apiRequestAsyncLocalStorage.run(store, () =>
    resolveSessionReplayAuth(
      new Request('http://example.test/api/query', { headers })
    )
  );
}
