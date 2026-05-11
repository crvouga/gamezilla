import {
  createApiRpcClient as createGenericApiRpcClient,
  type WithGlobalApiErrors,
} from '@gamezilla/api-rpc';
import type { createApiApp } from './app/create-app';

/** Hono app shape for `hono/client` RPC. Use `import type` from client — no runtime import. */
export type AppType = Awaited<ReturnType<typeof createApiApp>>;

/** Includes `app.onError` 401/500 JSON bodies for typed client narrowing. */
export type AppTypeWithGlobalErrors = WithGlobalApiErrors<AppType>;

/** Typed Hono RPC client for API callers (base URL should be API origin). */
export function createApiRpcClient(apiUrl: string) {
  return createGenericApiRpcClient<AppType>(apiUrl);
}

export type ApiRpcClient = ReturnType<typeof createApiRpcClient>;
