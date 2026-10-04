import { type ApplyGlobalResponse, hc } from 'hono/client';
import type { createServer } from './create-server';

/** Wraps a Hono app type with global 401/500 JSON bodies from `app.onError`. */
export type WithGlobalApiErrors<TAppType> = ApplyGlobalResponse<
  TAppType,
  {
    401: { json: { error: string } };
    500: { json: { error: string } };
  }
>;

function createGenericServerRpcClient<TAppType>(serverUrl: string) {
  const base = serverUrl.replace(/\/+$/, '');
  return hc<WithGlobalApiErrors<TAppType>>(`${base}/`);
}

/** Hono app shape for `hono/client` RPC. Use `import type` from client — no runtime import. */
export type AppType = Awaited<ReturnType<typeof createServer>>;

/** Includes `app.onError` 401/500 JSON bodies for typed client narrowing. */
export type AppTypeWithGlobalErrors = WithGlobalApiErrors<AppType>;

/** Typed Hono RPC client for server callers (base URL should be server origin). */
export function createServerRpcClient(serverUrl: string) {
  return createGenericServerRpcClient<AppType>(serverUrl);
}

export type ServerRpcClient = ReturnType<typeof createServerRpcClient>;
