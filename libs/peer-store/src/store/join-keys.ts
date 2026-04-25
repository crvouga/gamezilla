import { Assert } from '@gamezilla/lib/assert';
import type { PeerBootstrap, PeerStoreSecurityConfig } from './types';
import { seedDiscoveredPeerLiveness } from './authority-monitor';
import { decodeKeyB64, peerIdFromPublicKey, publicKeyFromSecretSeed } from './security/peer-crypto';

const crash: Assert = Assert.crash();

export type JoinGenesisKeyTarget = {
  peerId: string;
  security: PeerStoreSecurityConfig;
  memberPublicKeys: Map<string, Uint8Array>;
  last_seen: Map<string, number>;
};

export function installJoinGenesisKeys(
  target: JoinGenesisKeyTarget,
  jg: Extract<PeerBootstrap, { kind: 'join' }>,
): void {
  const myPub = publicKeyFromSecretSeed(target.security.secretSeed);
  target.memberPublicKeys.set(target.peerId, myPub);
  for (const [id, b64] of Object.entries(jg.initialMemberPublicKeys)) {
    let pub: Uint8Array;
    try {
      pub = decodeKeyB64(b64);
    } catch {
      crash.ok(false, 'join initialMemberPublicKeys must be valid base64url keys', {
        id,
      });
    }
    let derived: string;
    try {
      derived = peerIdFromPublicKey(pub);
    } catch {
      crash.ok(false, 'join initialMemberPublicKeys could not derive peerId', { id });
    }
    crash.ok(
      derived === id,
      'join initialMemberPublicKeys entry must match self-certifying peerId',
      { id, derived },
    );
    target.memberPublicKeys.set(id, pub);
  }
  for (const id of Object.keys(jg.initialMembership)) {
    seedDiscoveredPeerLiveness(target, id);
  }
}
