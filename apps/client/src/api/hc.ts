import { assertTigerPolicyForResolvedApiOrigin } from '@apps/client/config/api-servers';
import {
  createTypedApiRpcClient,
  type TypedApiRpcFetch,
} from '@libs/client-config/public/typed-api-rpc-client';

export type CreateApiClientOptions = {
  /** Injected transport (sim / playground in-process Hono). */
  readonly fetch?: TypedApiRpcFetch;
};

/**
 * Typed Hono RPC client for the API Worker. Base URL must be the API
 * origin (no legacy path suffix).
 *
 * Delegates to `@libs/client-config` so the client has no value/`package.json`
 * edge on `@apps/server` or a direct `hono` import (Metro resolves `hono/client`
 * from client-config's own dependency tree).
 */
export function createApiClient(
  apiUrl: string,
  options?: CreateApiClientOptions
) {
  if (typeof apiUrl !== 'string' || apiUrl.length === 0) {
    throw new Error('apiUrl must be a non-empty string');
  }
  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error(`apiUrl must be a valid URL, got: ${apiUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`apiUrl must use http or https, got: ${parsed.protocol}`);
  }
  assertTigerPolicyForResolvedApiOrigin(
    parsed.origin,
    'forbid-prod-in-expo-dev-bundle'
  );
  return createTypedApiRpcClient(
    parsed.toString(),
    options?.fetch !== undefined ? { fetch: options.fetch } : undefined
  );
}

export type ApiClient = ReturnType<typeof createApiClient>;
