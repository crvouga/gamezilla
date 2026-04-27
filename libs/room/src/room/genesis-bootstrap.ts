import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../persistence/log-entry';
import type { PeerBootstrap } from './types';
import { PeerJoined } from '../events/system-messages';
import { decodeKeyB64, peerIdFromPublicKey } from './security/peer-crypto';
import { rebuildMembershipFromLog } from './membership';
import type { StoreModule } from './types';
import { replayDomainEntries } from './replay';

const crash: Assert = Assert.crash();

export type GenesisCommittedSnapshot = {
  membership: Map<string, number>;
  committed_entries: LogEntry[];
  committed_state: ReturnType<StoreModule['initialState']>;
  last_committed_log_seq: number;
};

/** Validates genesis keys, fills `memberPublicKeys`, and builds initial committed snapshot. */
export function bootstrapGenesisCommittedState(
  module: StoreModule,
  memberPublicKeys: Map<string, Uint8Array>,
  peerId: string,
  b: Extract<PeerBootstrap, { kind: 'genesis' }>,
): GenesisCommittedSnapshot {
  const initial = { ...b.initialMembership };
  const keys = { ...b.initialMemberPublicKeys };
  const peerIds = Object.keys(initial);
  crash.ok(peerIds.length >= 2, 'genesis initialMembership must have >= 2 peers');
  crash.ok(peerId in initial, 'initialMembership must contain peerId');
  for (const [id, weight] of Object.entries(initial)) {
    crash.nonEmptyString(id, 'peer id must be non-empty');
    crash.ok(weight >= 0, `trust weight for peer ${id} must be >= 0`);
    crash.ok(id in keys, 'genesis initialMemberPublicKeys must contain every peer id', {
      id,
    });
    let pub: Uint8Array;
    try {
      pub = decodeKeyB64(keys[id]!);
    } catch {
      crash.ok(false, `invalid public key for peer ${id}`);
    }
    let derived: string;
    try {
      derived = peerIdFromPublicKey(pub);
    } catch {
      crash.ok(false, `could not derive peerId for peer ${id}`);
    }
    crash.ok(derived === id, 'peerId must be derived from initialMemberPublicKeys entry', {
      id,
      derived,
    });
    memberPublicKeys.set(id, pub);
  }

  const sortedIds = Object.keys(initial).sort((a, b) => a.localeCompare(b));
  const entries: LogEntry[] = sortedIds.map((id, idx) => ({
    seq: idx + 1,
    event: PeerJoined({
      peerId: id,
      trust: initial[id]!,
      publicKey: keys[id]!,
    }),
  }));
  const membership = rebuildMembershipFromLog(entries);
  const committed_state = replayDomainEntries(module, entries);
  const last_committed_log_seq = entries[entries.length - 1]!.seq;
  return {
    membership,
    committed_entries: entries,
    committed_state,
    last_committed_log_seq,
  };
}
