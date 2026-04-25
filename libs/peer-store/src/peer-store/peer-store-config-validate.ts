import { Assert } from '@gamezilla/lib/assert';
import type { PeerBootstrap } from './peer-store-types';
import { peerIdFromPublicKey, publicKeyFromSecretSeed } from './security/peer-crypto';

const crash: Assert = Assert.crash();

/** Fields required to validate `PeerStore` construction (matches `PeerStore` config minus transport). */
export type PeerStoreInitConfig = {
  topic: string;
  peerId: string;
  bootstrap: PeerBootstrap;
  security: { roomSecret: string; secretSeed: Uint8Array };
  timeoutMs?: number;
};

export function validatePeerStoreInitConfig(config: PeerStoreInitConfig): void {
  crash.nonEmptyString(config.topic, 'config.topic must be non-empty');
  crash.nonEmptyString(config.peerId, 'config.peerId must be non-empty');
  crash.record(config.security, 'config.security must be an object');
  crash.nonEmptyString(config.security.roomSecret, 'security.roomSecret must be non-empty');
  crash.ok(
    config.security.secretSeed instanceof Uint8Array &&
      config.security.secretSeed.length === 32,
    'security.secretSeed must be Uint8Array of length 32',
  );
  const pub = publicKeyFromSecretSeed(config.security.secretSeed);
  let derived: string;
  try {
    derived = peerIdFromPublicKey(pub);
  } catch {
    crash.fail('could not derive peerId from security.secretSeed');
  }
  crash.ok(
    derived === config.peerId,
    'config.peerId must equal peerId derived from security.secretSeed',
    { derived, peerId: config.peerId },
  );
  if (config.timeoutMs !== undefined) {
    crash.ok(config.timeoutMs > 0, 'timeoutMs must be > 0');
  }
  if (config.bootstrap.kind === 'join') {
    const m = config.bootstrap.initialMembership;
    const k = config.bootstrap.initialMemberPublicKeys;
    crash.record(m, 'join bootstrap requires initialMembership');
    crash.record(k, 'join bootstrap requires initialMemberPublicKeys');
    const ids = Object.keys(m);
    crash.ok(ids.length >= 2, 'join initialMembership must list at least 2 peers');
    for (const id of ids) {
      crash.ok(id in k, 'join initialMemberPublicKeys must cover initialMembership', {
        id,
      });
    }
  }
}
