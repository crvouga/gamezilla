import type {
  Patch,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import type { PatchDbClientTransport } from '@gamezilla/patch-db/transport';
import {
  NO_CACHE_REQUEST_HEADERS,
  PatchDbTransportRejectedError,
} from '@gamezilla/patch-db/transport';
import {
  assertPatchDbResults,
  assertPatches,
} from '@gamezilla/patch-db/validate-remote';
import type { GamezillaApiClient } from './hc';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
} as const;

export type CreatePatchDbHcTransportOptions = {
  /** Returns the current session bearer token, or null when unauthenticated. */
  getAuthToken?: () => string | null;
};

function authHeaders(
  getAuthToken?: () => string | null
): Record<string, string> {
  const token = getAuthToken?.() ?? null;
  if (token === null || token.length === 0) return {};
  return { Authorization: `Bearer ${token}` };
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
  client: GamezillaApiClient,
  options?: CreatePatchDbHcTransportOptions
): PatchDbClientTransport {
  const getAuthToken = options?.getAuthToken;
  return {
    async read(queries: PatchDbQuery[]): Promise<PatchDbResult[]> {
      if (queries.length === 0) return [];
      const res = await client['patch-db']['patches']['read'].$post(
        { json: { queries } },
        {
          headers: {
            ...JSON_HEADERS,
            ...NO_CACHE_REQUEST_HEADERS,
            ...authHeaders(getAuthToken),
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
      assertPatchDbResults(raw);
      return raw;
    },

    async write(patches: PatchInput[]): Promise<Patch[]> {
      const res = await client['patch-db']['patches']['write'].$post(
        { json: { patches } },
        {
          headers: {
            'Content-Type': 'application/json',
            ...NO_CACHE_REQUEST_HEADERS,
            ...authHeaders(getAuthToken),
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
      assertPatches(raw);
      return raw;
    },
  };
}
