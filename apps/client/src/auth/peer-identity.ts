import {
  decodeKeyB64,
  encodeKeyB64,
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
  randomSecretSeed,
} from '@gamezilla/room';
import { assertSecureStorageKey } from '@gamezilla/lib/secure-storage/contract';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';

const STORAGE_KEY = 'peer.seed.v1' as const;

export type PeerIdentity = {
  secretSeed: Uint8Array;
  peerId: string;
  publicKeyB64: string;
};

/**
 * Persistent Ed25519 identity for `@gamezilla/room` (one seed per device install).
 */
export async function loadOrCreatePeerIdentity(
  storage: SecureStorage,
  _deviceId: string
): Promise<PeerIdentity> {
  void _deviceId;
  assertSecureStorageKey(STORAGE_KEY);
  const existing = await storage.getItem(STORAGE_KEY);
  let secretSeed: Uint8Array;
  if (typeof existing === 'string' && existing.length > 0) {
    secretSeed = decodeKeyB64(existing);
  } else {
    secretSeed = randomSecretSeed();
    await storage.setItem(STORAGE_KEY, encodeKeyB64(secretSeed));
  }
  const publicKey = publicKeyFromSecretSeed(secretSeed);
  const peerId = peerIdFromPublicKey(publicKey);
  const publicKeyB64 = encodeKeyB64(publicKey);
  return { secretSeed, peerId, publicKeyB64 };
}
