import { useConfigService } from '@libs/auth-client/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client/use-client-request-auth';
import { clientAuthHeaders } from '@libs/auth-shared/client-request-auth';
import { useHttpClient } from '@pkgs/http-client-client/solid';

/** External source upload only; status and commands use the sync engine. */
export function usePuzzleManagementApi() {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  return async (
    uploadId: string,
    part: number,
    csv: string,
    signal: AbortSignal
  ): Promise<void> => {
    const base = config.getApiUrl().replace(/\/$/, '');
    const response = await http.fetch(
      `${base}/api/puzzle-management/source/${uploadId}/${String(part)}`,
      {
        method: 'PUT',
        signal,
        body: csv,
        headers: {
          ...clientAuthHeaders(auth, { requireAccountIdForBearer: true }),
          'content-type': 'text/csv',
        },
      }
    );
    if (!response.ok)
      throw new Error(
        `CSV upload failed (${String(response.status)}). Select the file and start again.`
      );
  };
}
