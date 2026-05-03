import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

/**
 * Reserved for future one-off storage migrations. No legacy keys are read
 * (identity rename dropped backwards compatibility).
 */
export async function migrateDeviceStorageWebLegacy(
  _storage: SecureStorage,
  _canonicalKey: string
): Promise<void> {
  return;
}
