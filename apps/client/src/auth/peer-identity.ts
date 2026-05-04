import { assertSecureStorageKey } from '@gamezilla/lib/secure-storage/contract';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

const LEGACY_PEER_SEED_KEY = 'peer.seed.v1' as const;

/** One-shot migration: remove legacy install-wide peer seed. */
export async function removeLegacyPeerSeedIfPresent(
  storage: SecureStorage
): Promise<void> {
  assertSecureStorageKey(LEGACY_PEER_SEED_KEY);
  await storage.deleteItem(LEGACY_PEER_SEED_KEY);
}
