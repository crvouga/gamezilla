import type { AppType } from '@libs/server-app/rpc';
import { type ApplyGlobalResponse, hc } from 'hono/client';

type WithGlobalApiErrors<TAppType> = ApplyGlobalResponse<
  TAppType,
  {
    401: { json: { error: string } };
    500: { json: { error: string } };
  }
>;

export type TypedApiRpcFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type CreateTypedApiRpcClientOptions = {
  /** When set, Hono RPC uses this transport instead of global `fetch`. */
  readonly fetch?: TypedApiRpcFetch;
};

/**
 * Typed Hono RPC client for the API. Duplicates the shape of
 * `@libs/server-app/rpc` so this package does not take a **value** dependency on
 * `@libs/server-app` (avoids `api` ↔ `client-config` package cycles — `api`
 * mounts `client-config`). `import type { AppType }` is type-only.
 */
export function createTypedApiRpcClient(
  apiUrl: string,
  options?: CreateTypedApiRpcClientOptions
) {
  const base = apiUrl.replace(/\/+$/, '');
  return hc<WithGlobalApiErrors<AppType>>(
    `${base}/`,
    options?.fetch !== undefined ? { fetch: options.fetch } : undefined
  );
}
