import { isUuid } from '@gamezilla/domain/auth/device-id';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

/** Persisted echo of the server's httpOnly `clientId` cookie (see GET `/auth/client-id`). */
export const HTTP_CLIENT_ID_STORAGE_KEY = 'gamezilla.httpClientId';

/**
 * Returns a stable server-issued client id for anonymous local DB naming. Fetches
 * `GET {apiBase}/auth/client-id` with credentials on first run (or corrupt storage),
 * then caches in secure storage.
 */
export async function ensureServerClientId(
  apiBase: string,
  storage: SecureStorage
): Promise<string> {
  const existing = await storage.getItem(HTTP_CLIENT_ID_STORAGE_KEY);
  if (existing !== null && isUuid(existing)) {
    return existing;
  }

  const url = String(`${apiBase.replace(/\/$/, '')}/auth/client-id`);
  const res = await fetch(url, { method: 'GET', credentials: 'include' });
  if (!res.ok) {
    throw new Error(
      `ensureServerClientId: GET /auth/client-id failed (${String(res.status)})`
    );
  }
  const json: unknown = await res.json();
  if (
    typeof json !== 'object' ||
    json === null ||
    !('clientId' in json) ||
    typeof (json as { clientId: unknown }).clientId !== 'string'
  ) {
    throw new Error(
      'ensureServerClientId: response must be { clientId: string }'
    );
  }
  const clientId = (json as { clientId: string }).clientId;
  if (!isUuid(clientId)) {
    throw new Error('ensureServerClientId: clientId must be a UUID');
  }
  await storage.setItem(HTTP_CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}
