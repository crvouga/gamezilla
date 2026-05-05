import type {
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '@gamezilla/patch-db/interface';
import type { PatchDbClientTransport } from '@gamezilla/patch-db/transport';
import {
  NO_CACHE_REQUEST_HEADERS,
  PatchDbTransportRejectedError,
} from '@gamezilla/patch-db/transport';
import {
  assertWireReadResponse,
  assertWireWriteResponse,
} from '@gamezilla/patch-db/validate-remote';
import type { ApiClient } from './hc';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
} as const;

/** Must match {@link ANON_ID_HEADER} in apps/api session-middleware. */
const X_ANON_ID = 'x-anon-id';

export type CreatePatchDbHcTransportOptions = {
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

function authHeaders(options: {
  getAuthToken?: () => string | null;
  getAnonId?: () => string | null;
}): Record<string, string> {
  const token = options.getAuthToken?.() ?? null;
  if (token !== null && token.length > 0) {
    return { Authorization: `Bearer ${token}` };
  }
  const anon = options.getAnonId?.() ?? null;
  if (anon !== null && anon.length > 0) {
    return { [X_ANON_ID]: anon };
  }
  return {};
}

function throwHcFailure(status: number, text: string): never {
  if (status === 401 || status === 403) {
    throw new PatchDbTransportRejectedError(status, text);
  }
  throw new Error(`HTTP ${String(status)}: ${text}`);
}

/**
 * Patch-db sync transport using the Hono RPC client (`/patch-db/patches/read|write`).
 */
export function createPatchDbHcTransport(
  client: ApiClient,
  options: CreatePatchDbHcTransportOptions
): PatchDbClientTransport {
  const { getAuthToken, getAnonId, patchDbBaseUrl: _patchDbBaseUrl } = options;
  void _patchDbBaseUrl;
  const hdr = () =>
    authHeaders({
      ...(getAuthToken !== undefined ? { getAuthToken } : {}),
      ...(getAnonId !== undefined ? { getAnonId } : {}),
    });
  return {
    async read(queries: PatchDbQuery[]): Promise<PatchDbResult[]> {
      if (queries.length === 0) {
        throw new Error(
          'createPatchDbHcTransport.read: empty queries unsupported over HTTP'
        );
      }
      const res = await client['patch-db']['patches']['read'].$post(
        { json: { queries } },
        {
          headers: {
            ...JSON_HEADERS,
            ...NO_CACHE_REQUEST_HEADERS,
            ...hdr(),
          },
          init: { credentials: 'include' },
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throwHcFailure(res.status, text);
      }
      let raw: unknown;
      try {
        raw = await res.json();
      } catch {
        throw new Error(
          `Response body is not valid JSON (status ${String(res.status)})`
        );
      }
      assertWireReadResponse(raw);
      return raw.results;
    },

    async write(patches: PatchInput[]): Promise<WritePatchesResult> {
      const res = await client['patch-db']['patches']['write'].$post(
        { json: { patches } },
        {
          headers: {
            'Content-Type': 'application/json',
            ...NO_CACHE_REQUEST_HEADERS,
            ...hdr(),
          },
          init: { credentials: 'include' },
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throwHcFailure(res.status, text);
      }
      let raw: unknown;
      try {
        raw = await res.json();
      } catch {
        throw new Error(
          `Response body is not valid JSON (status ${String(res.status)})`
        );
      }
      assertWireWriteResponse(raw);
      return raw;
    },
  };
}
