import { isUuid } from '@gamezilla/domain/auth/device-id';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

/**
 * When set, cold start opens this account's SQLite file so session rows in patch-db
 * are reachable before any HTTP round-trip.
 */
export const LAST_LOCAL_ACCOUNT_ID_KEY = 'gamezilla.lastLocalAccountId';

export async function readLastLocalAccountId(
  storage: SecureStorage
): Promise<string | null> {
  const raw = await storage.getItem(LAST_LOCAL_ACCOUNT_ID_KEY);
  if (raw === null || !isUuid(raw)) return null;
  return raw;
}

export async function writeLastLocalAccountId(
  storage: SecureStorage,
  accountId: string | null
): Promise<void> {
  if (accountId === null) {
    await storage.deleteItem(LAST_LOCAL_ACCOUNT_ID_KEY);
    return;
  }
  if (!isUuid(accountId)) {
    throw new Error('writeLastLocalAccountId: accountId must be a UUID');
  }
  await storage.setItem(LAST_LOCAL_ACCOUNT_ID_KEY, accountId);
}
