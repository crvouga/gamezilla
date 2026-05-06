import { deleteAnonymousDatabaseFileBestEffort } from '@gamezilla/client/db/account-db';
import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { secureStorageAtom, sessionServiceAtom } from '@gamezilla/client/runtime/atoms';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { getDefaultStore } from 'jotai';
import { ensureDeviceEntity } from './ensure-device-entity';
import { ensureProfile } from './ensure-profile-entity';

/**
 * After the server has bound Clerk → internal `accountId`, finish local-first
 * setup (profile row, device row, SQLite account selection).
 */
export async function finalizeLocalSignInAfterServerAccount(args: {
  db: PatchDb;
  deviceId: string;
  accountId: string;
}): Promise<void> {
  const { db, deviceId, accountId } = args;
  const store = getDefaultStore();
  const storage = store.get(secureStorageAtom);
  await writeLastLocalAccountId(storage, accountId);
  await deleteAnonymousDatabaseFileBestEffort(deviceId);
  await ensureDeviceEntity(db, deviceId);
  await ensureProfile(db, accountId);
  const sessionSvc = await store.get(sessionServiceAtom);
  await sessionSvc.refresh();
}
