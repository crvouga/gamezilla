import { hc, type ApplyGlobalResponse } from 'hono/client';

import type { AppType } from '@apps/api/rpc';

type WithGlobalApiErrors<TAppType> = ApplyGlobalResponse<
  TAppType,
  {
    401: { json: { error: string } };
    500: { json: { error: string } };
  }
>;

/**
 * Typed Hono RPC client for the API. Duplicates the shape of
 * `@apps/api/rpc` so this package does not take a **value** dependency on
 * `@apps/api` (avoids `api` ↔ `client-config` package cycles — `api`
 * mounts `client-config`). `import type { AppType }` is type-only.
 */
export function createTypedApiRpcClient(apiUrl: string) {
  const base = apiUrl.replace(/\/+$/, '');
  return hc<WithGlobalApiErrors<AppType>>(`${base}/`);
}
