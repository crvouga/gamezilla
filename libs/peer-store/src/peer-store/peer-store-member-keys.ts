import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../persistence/log-entry';
import { PeerJoined, PeerLeave } from '../protocol/system-messages';
import { decodeKeyB64, publicKeyFromSecretSeed } from './security/peer-crypto';

const crash: Assert = Assert.crash();

export function rebuildMemberPublicKeysFromCommittedLog(
  memberPublicKeys: Map<string, Uint8Array>,
  ctx: {
    bootstrapKind: 'genesis' | 'join';
    peerId: string;
    secretSeed: Uint8Array;
  },
  entries: LogEntry[],
): void {
  memberPublicKeys.clear();
  if (ctx.bootstrapKind === 'join') {
    memberPublicKeys.set(ctx.peerId, publicKeyFromSecretSeed(ctx.secretSeed));
  }
  for (const { event } of entries) {
    if (PeerJoined.is(event)) {
      try {
        memberPublicKeys.set(
          event.payload.peerId,
          decodeKeyB64(event.payload.publicKey),
        );
      } catch {
        crash.ok(false, 'log contains PeerJoined with invalid publicKey');
      }
    }
    if (PeerLeave.is(event)) {
      memberPublicKeys.delete(event.payload.peerId);
    }
  }
}
