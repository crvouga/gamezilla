import { deleteAnonymousDatabaseFileBestEffort } from '@gamezilla/auth/client/account-db';
import { writeLastLocalAccountId } from '@gamezilla/auth/client/account-local-state';
import type { PatchDb } from '@gamezilla/patch-db/interface';

import { getRegisteredClientStore } from './client-store-register';
import { ensureDeviceEntity } from './ensure-device-entity';

/**
 * Hook supplied by the profile feature to seed the profile row after sign-in.
 * Injected to keep this file from depending on @gamezilla/profile (would
 * create an auth ↔ profile package cycle).
 */
export type EnsureProfileFn = (db: PatchDb, accountId: string) => Promise<void>;

/**
 * After the server has bound hosted auth → internal `accountId`, finish local-first
 * setup (profile row, device row, SQLite account selection).
 */
export async function finalizeLocalSignInAfterServerAccount(args: {
  db: PatchDb;
  deviceId: string;
  accountId: string;
  ensureProfile: EnsureProfileFn;
}): Promise<void> {
  const { db, deviceId, accountId, ensureProfile } = args;
  const store = getRegisteredClientStore();
  const storage = store.getSecureStorage();
  await writeLastLocalAccountId(storage, accountId);
  await store.enqueueSqlClientLifecycle(() =>
    deleteAnonymousDatabaseFileBestEffort(deviceId)
  );
  await ensureDeviceEntity(db, deviceId);
  await ensureProfile(db, accountId);
  const sessionSvc = await store.getSessionService();
  await sessionSvc.refresh();
}
