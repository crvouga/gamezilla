import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { Platform } from 'react-native';

/** Before SecureStore key contract, web used a colon in the key (invalid on native). */
const LEGACY_PRINCIPAL_STORAGE_KEY = 'gamezilla:principalId';

/**
 * One-time: copy principal from legacy web localStorage key into the canonical key.
 * Native never successfully persisted under the legacy key (SecureStore rejects `:`).
 */
export async function migratePrincipalStorageWebLegacy(
  storage: SecureStorage,
  canonicalKey: string
): Promise<void> {
  if (Platform.OS !== 'web') {
    return;
  }
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }
  const existing = await storage.getItem(canonicalKey);
  if (existing !== null) {
    return;
  }
  const legacy = globalThis.localStorage.getItem(LEGACY_PRINCIPAL_STORAGE_KEY);
  if (legacy === null) {
    return;
  }
  await storage.setItem(canonicalKey, legacy);
  globalThis.localStorage.removeItem(LEGACY_PRINCIPAL_STORAGE_KEY);
}
