import type {
  Patch,
  PatchInput,
  PatchesDbQuery,
  PatchesDbResult,
} from '@gamezilla/patch-db/interface';
import type { PatchDbClientTransport } from '@gamezilla/patch-db/transport';
import { NO_CACHE_REQUEST_HEADERS } from '@gamezilla/patch-db/transport';
import { assertPatches, assertPatchesDbResults } from '@gamezilla/patch-db/validate-remote';
import type { GamezillaApiClient } from './hc';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
} as const;

/**
 * Patch-db sync transport using the Hono RPC client (`/patch-db/patches/read|write`).
 */
export function createPatchDbHcTransport(
  client: GamezillaApiClient
): PatchDbClientTransport {
  return {
    async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
      if (queries.length === 0) return [];
      const res = await client['patch-db']['patches']['read'].$post(
        { json: { queries } },
        {
          headers: {
            ...JSON_HEADERS,
            ...NO_CACHE_REQUEST_HEADERS,
          },
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${String(res.status)}: ${text}`);
      }
      let raw: unknown;
      try {
        raw = await res.json();
      } catch {
        throw new Error(
          `Response body is not valid JSON (status ${String(res.status)})`
        );
      }
      assertPatchesDbResults(raw);
      return raw;
    },

    async write(patches: PatchInput[]): Promise<Patch[]> {
      const res = await client['patch-db']['patches']['write'].$post(
        { json: { patches } },
        {
          headers: {
            'Content-Type': 'application/json',
            ...NO_CACHE_REQUEST_HEADERS,
          },
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${String(res.status)}: ${text}`);
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
