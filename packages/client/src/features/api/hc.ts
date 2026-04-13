import { hc } from 'hono/client';
import type { AppTypeWithGlobalErrors } from '@gamezilla/api/rpc';

/**
 * Typed Hono RPC client for the gamezilla API Worker. Base URL must be the API
 * origin (no `/patch-db` suffix).
 */
export function createGamezillaApiClient(apiUrl: string) {
  const base = apiUrl.replace(/\/$/, '');
  return hc<AppTypeWithGlobalErrors>(`${base}/`);
}

export type GamezillaApiClient = ReturnType<typeof createGamezillaApiClient>;
