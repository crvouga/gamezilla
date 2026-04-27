import { assertTigerPolicyForResolvedApiOrigin } from '@gamezilla/domain/config/api-servers';
import { hc } from 'hono/client';
import type { AppTypeWithGlobalErrors } from '@gamezilla/api/rpc';

/**
 * Typed Hono RPC client for the gamezilla API Worker. Base URL must be the API
 * origin (no `/patch-db` suffix).
 */
export function createGamezillaApiClient(apiUrl: string) {
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
  const base = apiUrl.replace(/\/$/, '');
  return hc<AppTypeWithGlobalErrors>(`${base}/`);
}

export type GamezillaApiClient = ReturnType<typeof createGamezillaApiClient>;
