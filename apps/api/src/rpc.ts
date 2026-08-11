import { type ApplyGlobalResponse, hc } from 'hono/client';
import type { createApiApp } from './app/create-app';

/** Wraps a Hono app type with global 401/500 JSON bodies from `app.onError`. */
export type WithGlobalApiErrors<TAppType> = ApplyGlobalResponse<
  TAppType,
  {
    401: { json: { error: string } };
    500: { json: { error: string } };
  }
>;

function createGenericApiRpcClient<TAppType>(apiUrl: string) {
  const base = apiUrl.replace(/\/+$/, '');
  return hc<WithGlobalApiErrors<TAppType>>(`${base}/`);
}

/** Hono app shape for `hono/client` RPC. Use `import type` from client — no runtime import. */
export type AppType = Awaited<ReturnType<typeof createApiApp>>;

/** Includes `app.onError` 401/500 JSON bodies for typed client narrowing. */
export type AppTypeWithGlobalErrors = WithGlobalApiErrors<AppType>;

/** Typed Hono RPC client for API callers (base URL should be API origin). */
export function createApiRpcClient(apiUrl: string) {
  return createGenericApiRpcClient<AppType>(apiUrl);
}

export type ApiRpcClient = ReturnType<typeof createApiRpcClient>;
