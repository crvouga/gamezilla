import { hc, type ApplyGlobalResponse } from 'hono/client';
import type { createApiApp } from './create-api-app';

/** Hono app shape for `hono/client` RPC. Use `import type` from client — no runtime import. */
export type AppType = ReturnType<typeof createApiApp>;

/** Includes `app.onError` 401/500 JSON bodies for typed client narrowing. */
export type AppTypeWithGlobalErrors = ApplyGlobalResponse<
  AppType,
  {
    401: { json: { error: string } };
    500: { json: { error: string } };
  }
>;

/** Typed Hono RPC client for API callers (base URL should be API origin). */
export function createApiRpcClient(apiUrl: string) {
  const base = apiUrl.replace(/\/+$/, '');
  return hc<AppTypeWithGlobalErrors>(`${base}/`);
}

export type ApiRpcClient = ReturnType<typeof createApiRpcClient>;
