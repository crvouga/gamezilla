import { writeLastLocalAccountId } from './account-local-state';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { PatchDb } from '@gamezilla/patch-db/interface';

import { ensureDeviceEntity } from './ensure-device-entity';

/**
 * Hook supplied by the profile feature to seed the profile row after sign-in.
 * Injected to keep this file from depending on @gamezilla/profile (would
 * create an auth ↔ profile package cycle).
 */
export type EnsureProfileFn = (db: PatchDb, accountId: string) => Promise<void>;

export type FinalizeLocalSignInDeps = {
  storage: SecureStorage;
  refreshSession: () => Promise<void>;
};

/**
 * After the server has bound hosted auth → internal `accountId`, persist that
 * id locally and seed the device + profile rows in the single shared patch-db.
 *
 * No SQLite swap or anonymous-DB cleanup is needed any more — the app uses
 * one `main` database for every signed-in or anonymous identity.
 */
export async function finalizeLocalSignInAfterServerAccount(args: {
  db: PatchDb;
  deviceId: string;
  accountId: string;
  ensureProfile: EnsureProfileFn;
  deps: FinalizeLocalSignInDeps;
}): Promise<void> {
  const { db, deviceId, accountId, ensureProfile, deps } = args;
  const { storage, refreshSession } = deps;
  await writeLastLocalAccountId(storage, accountId);
  await ensureDeviceEntity(db, deviceId);
  await ensureProfile(db, accountId);
  await refreshSession();
}
