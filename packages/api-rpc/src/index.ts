import { hc, type ApplyGlobalResponse } from 'hono/client';

/**
 * Wraps a Hono app type with the global error responses that
 * `@gamezilla/api`'s `app.onError` emits for 401/500. Kept here in a leaf
 * package so RPC consumers (client, client-config, infra) can construct a
 * typed Hono client without pulling in `@gamezilla/api` at runtime.
 *
 * The actual `AppType` is supplied by the caller via the `TAppType` generic
 * (commonly via a type-only import from `@gamezilla/api/rpc`), keeping this
 * package free of any dependency on `@gamezilla/api`.
 */
export type WithGlobalApiErrors<TAppType> = ApplyGlobalResponse<
  TAppType,
  {
    401: { json: { error: string } };
    500: { json: { error: string } };
  }
>;

/**
 * Constructs a typed Hono RPC client pointed at the gamezilla API Worker.
 *
 * Type-only: the consumer supplies the API app type as a generic parameter so
 * that `@gamezilla/api-rpc` stays a leaf with no `@gamezilla/api` import.
 */
export function createApiRpcClient<TAppType>(apiUrl: string) {
  const base = apiUrl.replace(/\/+$/, '');
  return hc<WithGlobalApiErrors<TAppType>>(`${base}/`);
}

export type ApiRpcClient<TAppType> = ReturnType<
  typeof createApiRpcClient<TAppType>
>;
