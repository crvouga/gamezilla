import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

/**
 * Bearer token persisted on every platform via the same {@link SecureStorage}
 * that holds the deviceId / lastLocalAccountId. Native: SecureStore. Web:
 * localStorage. Hydrated into `sessionTokenAtom` on cold start so the very
 * first patch-db request carries the Authorization header.
 */
export const SESSION_TOKEN_STORAGE_KEY = 'gamezilla.sessionToken';

export async function readSessionToken(
  storage: SecureStorage
): Promise<string | null> {
  const raw = await storage.getItem(SESSION_TOKEN_STORAGE_KEY);
  if (raw === null || raw.length === 0) return null;
  return raw;
}

export async function writeSessionToken(
  storage: SecureStorage,
  token: string | null
): Promise<void> {
  if (token === null || token.length === 0) {
    await storage.deleteItem(SESSION_TOKEN_STORAGE_KEY);
    return;
  }
  await storage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
}
