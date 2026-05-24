import type { PatchDbClientTransport } from '@pkgs/patch-db/transport/interface';
import { PatchDbClientTransportHttpFetch } from '@pkgs/patch-db/transport/impl-http-fetch';

/** Must match {@link ANON_ID_HEADER} in apps/api session-middleware. */
const X_ANON_ID = 'x-anon-id';

export type CreatePatchDbHttpTransportOptions = {
  /** Same origin + path prefix as read/write (e.g. `https://host/patch-db`). */
  patchDbBaseUrl: string;
  /**
   * Returns the current session bearer token, or null when unauthenticated.
   * Prefer `getDefaultStore().get(sessionTokenAtom)` (or equivalent) **per
   * request** so token refresh rotates the header without rebuilding the
   * transport; do not capture a fixed token in a closure.
   */
  getAuthToken?: () => string | null;
  /**
   * Install id sent as `x-anon-id` when there is no Bearer token so the API
   * can resolve patch-db `myId` for anonymous clients.
   */
  getAnonId?: () => string | null;
};

function bearerPlusAnonHeaders(
  token: string,
  anon: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (anon !== null && anon.length > 0) {
    headers[X_ANON_ID] = anon;
  }
  return headers;
}

function authHeaders(options: {
  getAuthToken?: () => string | null;
  getAnonId?: () => string | null;
}): Record<string, string> {
  const token = options.getAuthToken?.() ?? null;
  const anon = options.getAnonId?.() ?? null;
  if (token !== null && token.length > 0) {
    return bearerPlusAnonHeaders(token, anon);
  }
  if (anon !== null && anon.length > 0) {
    return { [X_ANON_ID]: anon };
  }
  return {};
}

/**
 * Patch-db sync transport over `/patch-db/patches/read|write` with batched
 * JSON request/response (no streaming).
 */
export function createPatchDbHttpTransport(
  options: CreatePatchDbHttpTransportOptions
): PatchDbClientTransport {
  const { getAuthToken, getAnonId, patchDbBaseUrl } = options;
  return new PatchDbClientTransportHttpFetch(patchDbBaseUrl, {
    getHeaders: () =>
      authHeaders({
        ...(getAuthToken !== undefined ? { getAuthToken } : {}),
        ...(getAnonId !== undefined ? { getAnonId } : {}),
      }),
  });
}

/** @deprecated Use {@link createPatchDbHttpTransport}. */
export const createPatchDbHcTransport = createPatchDbHttpTransport;

export type CreatePatchDbHcTransportOptions = CreatePatchDbHttpTransportOptions;
