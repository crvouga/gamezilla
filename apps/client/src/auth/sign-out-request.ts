import { createApiClient } from '@gamezilla/client/api/hc';

/**
 * Calls server-side `POST /auth/sign-out` with the current Bearer. Idempotent
 * by design — server returns 204 even when the token is unknown / already
 * revoked. Network failures are intentionally surfaced so callers can decide
 * whether to swallow them (offline path).
 */
export async function postAuthSignOut(args: {
  apiUrl: string;
  bearer: string;
}): Promise<void> {
  const { apiUrl, bearer } = args;
  const client = createApiClient(apiUrl);
  const response = await client.auth['sign-out'].$post(undefined, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (response.status === 204 || response.status === 401) {
    return;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sign-out failed (${String(response.status)}): ${text}`);
  }
}
