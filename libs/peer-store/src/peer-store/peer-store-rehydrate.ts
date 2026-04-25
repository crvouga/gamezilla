import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../persistence/log-entry';
import { seedAllRemotePeersLiveness } from './authority-monitor';
import { rebuildMembershipFromLog } from './membership';
import type {
  PeerStoreSecurityConfig,
  State,
  StoreModule,
} from './peer-store-types';
import { rebuildMemberPublicKeysFromCommittedLog } from './peer-store-member-keys';
import { replayDomainEntries } from './replay';
import type { OptimisticEvent } from './wire-protocol';

const crash: Assert = Assert.crash();
const validation: Assert = Assert.validation();

export type PeerStoreRehydrateTarget = {
  module: StoreModule;
  peerId: string;
  bootstrapKind: 'genesis' | 'join';
  security: PeerStoreSecurityConfig;
  membership: Map<string, number>;
  memberPublicKeys: Map<string, Uint8Array>;
  committed_entries: LogEntry[];
  committed_state: State;
  optimistic_events: OptimisticEvent[];
  pending_timeouts: Map<string, ReturnType<typeof setTimeout>>;
  finalized_command_ids: Set<string>;
  last_committed_log_seq: number;
  synced: boolean;
  pendingSyncSessionId: string | null;
  last_seen: Map<string, number>;
  rebuildAuthorityFromMembership(): void;
  notifySubscribers(): void;
};

export function applyRehydrateCommittedEntries(
  target: PeerStoreRehydrateTarget,
  entries: LogEntry[],
): void {
  crash.array(entries, 'entries must be an array');
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  let prev = 0;
  for (const e of sorted) {
    validation.nonEmptyString(
      e.event.type,
      'rehydrated event must have non-empty type',
    );
    crash.ok(
      e.seq > prev,
      'rehydrate entries must have strictly increasing seq',
    );
    prev = e.seq;
  }

  target.membership = rebuildMembershipFromLog(sorted);
  rebuildMemberPublicKeysFromCommittedLog(
    target.memberPublicKeys,
    {
      bootstrapKind: target.bootstrapKind,
      peerId: target.peerId,
      secretSeed: target.security.secretSeed,
    },
    sorted,
  );
  target.committed_entries = [...sorted];
  target.committed_state = replayDomainEntries(target.module, sorted);
  target.optimistic_events = [];

  for (const timeout of target.pending_timeouts.values()) {
    clearTimeout(timeout);
  }
  target.pending_timeouts.clear();
  target.finalized_command_ids.clear();

  target.last_committed_log_seq =
    sorted.length > 0 ? sorted[sorted.length - 1]!.seq : 0;

  target.rebuildAuthorityFromMembership();
  seedAllRemotePeersLiveness({
    peerId: target.peerId,
    last_seen: target.last_seen,
    membership: target.membership,
  });
  target.synced = true;
  target.pendingSyncSessionId = null;
  target.notifySubscribers();
}
