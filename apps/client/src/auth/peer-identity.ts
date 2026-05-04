import {
  decodeKeyB64,
  encodeKeyB64,
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
  randomSecretSeed,
} from '@gamezilla/room';
import { assertSecureStorageKey } from '@gamezilla/lib/secure-storage/contract';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

const LEGACY_PEER_SEED_KEY = 'peer.seed.v1' as const;

export type PeerIdentity = {
  secretSeed: Uint8Array;
  peerId: string;
  publicKeyB64: string;
};

/** Secure-storage key for the host's stable Room signing seed for a space. */
export function hostRoomSeedStorageKey(spaceId: string): string {
  return `host.room.seed.v1.${spaceId}`;
}

/**
 * Ephemeral Ed25519 identity for a single Room connection (e.g. guest tab).
 * Distinct per call — no persistence.
 */
export function createSessionPeerIdentity(): PeerIdentity {
  const secretSeed = randomSecretSeed();
  const publicKey = publicKeyFromSecretSeed(secretSeed);
  const peerId = peerIdFromPublicKey(publicKey);
  const publicKeyB64 = encodeKeyB64(publicKey);
  return { secretSeed, peerId, publicKeyB64 };
}

export async function loadOrCreateHostRoomSeed(
  storage: SecureStorage,
  spaceId: string
): Promise<Uint8Array> {
  const key = hostRoomSeedStorageKey(spaceId);
  assertSecureStorageKey(key);
  const existing = await storage.getItem(key);
  if (typeof existing === 'string' && existing.length > 0) {
    return decodeKeyB64(existing);
  }
  const secretSeed = randomSecretSeed();
  await storage.setItem(key, encodeKeyB64(secretSeed));
  return secretSeed;
}

/** One-shot migration: remove legacy install-wide peer seed (replaced by per-tab + per-space host seeds). */
export async function removeLegacyPeerSeedIfPresent(
  storage: SecureStorage
): Promise<void> {
  assertSecureStorageKey(LEGACY_PEER_SEED_KEY);
  await storage.deleteItem(LEGACY_PEER_SEED_KEY);
}
