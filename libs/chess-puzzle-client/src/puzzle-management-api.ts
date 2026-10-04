import { useConfigService } from '@libs/auth-client/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared/client-request-auth';
import type { PuzzleLoadJob } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { useHttpClient } from '@pkgs/http-client-client/solid';

function readJob(value: unknown): PuzzleLoadJob | null {
  if (value === null) return null;
  if (typeof value !== 'object' || value === null || !('id' in value)) {
    throw new Error('Puzzle management returned an invalid job');
  }
  return value as PuzzleLoadJob;
}

export function usePuzzleManagementApi(): {
  readonly latest: () => Promise<PuzzleLoadJob | null>;
  readonly start: () => Promise<PuzzleLoadJob>;
} {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  const request = async (
    method: 'GET' | 'POST'
  ): Promise<PuzzleLoadJob | null> => {
    const base = config.getApiUrl().replace(/\/$/, '');
    const response = await http.fetch(`${base}/api/puzzle-management/job`, {
      method,
      headers: clientAuthHeaders(auth, { requireAccountIdForBearer: true }),
    });
    if (!response.ok) {
      throw new Error(`Puzzle management failed (${String(response.status)})`);
    }
    const body = (await response.json()) as { readonly job?: unknown };
    return readJob(body.job);
  };
  return {
    latest: () => request('GET'),
    start: async () => {
      const job = await request('POST');
      if (job === null) throw new Error('Puzzle management returned no job');
      return job;
    },
  };
}
