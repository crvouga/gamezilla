import { useConfigService } from '@libs/auth-client/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared/client-request-auth';
import {
  type SavedPuzzleSource,
  savedPuzzleSourceSchema,
} from '@libs/chess-puzzle-shared/puzzle-source';
import { useHttpClient } from '@pkgs/http-client-client/solid';

export class PuzzleSourceRequestError extends Error {
  constructor(
    readonly status: number,
    detail: string
  ) {
    super(`Lichess file request failed (${String(status)}). ${detail}`);
  }
}

/** External source bytes and metadata; domain status and commands use sync. */
export function usePuzzleManagementApi() {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  const request = async (suffix: string, init: RequestInit) => {
    const response = await http.fetch(
      `${config.getApiUrl().replace(/\/$/, '')}/api/puzzle-management/source${suffix}`,
      {
        ...init,
        headers: {
          ...clientAuthHeaders(auth, { requireAccountIdForBearer: true }),
          ...init.headers,
        },
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new PuzzleSourceRequestError(response.status, detail);
    }
    return response;
  };
  const readSource = async (
    response: Response
  ): Promise<SavedPuzzleSource | null> => {
    const value = (await response.json()) as { source: unknown };
    return value.source === null
      ? null
      : savedPuzzleSourceSchema.parse(value.source);
  };
  return {
    read: async (signal: AbortSignal) =>
      readSource(await request('', { method: 'GET', signal })),
    save: async (source: SavedPuzzleSource, signal: AbortSignal) =>
      readSource(
        await request('', {
          method: 'POST',
          signal,
          body: JSON.stringify(source),
          headers: { 'content-type': 'application/json' },
        })
      ),
    upload: async (
      id: string,
      part: number,
      csv: string,
      signal: AbortSignal
    ) => {
      const response = await request(`/${id}/${String(part)}`, {
        method: 'PUT',
        signal,
        body: csv,
        headers: { 'content-type': 'text/csv' },
      });
      await response.body?.cancel();
    },
  };
}
