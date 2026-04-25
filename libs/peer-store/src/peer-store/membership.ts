import { Assert } from '@gamezilla/lib/assert';
import { createMessageRouter } from '@gamezilla/lib/message';
import type { LogEntry } from '../persistence/log-entry'
import type { Event } from '../protocol/message-types'
import type { Snapshot, StoreModule } from './peer-store-types'
import {
  PeerJoined,
  PeerLeft,
  peerNamespace,
  PeerTrustUpdated,
} from '../protocol/system-messages';
import { isSystemEvent } from '../protocol/utils'
import { replayDomainEntries } from './replay'

const crash: Assert = Assert.crash();

const membershipEventRouter = createMessageRouter<
  Map<string, number>,
  void,
  void
>(peerNamespace)
  .on(PeerJoined, (membership, _, msg) => {
    const { peerId, trust } = msg.payload;
    crash.nonEmptyString(peerId, '_peer/joined requires peerId');
    crash.ok(
      typeof trust === 'number' && trust >= 0,
      'trust must be number >= 0'
    );
    membership.set(peerId, trust);
  })
  .on(PeerLeft, (membership, _, msg) => {
    const { peerId } = msg.payload;
    crash.nonEmptyString(peerId, '_peer/left requires peerId');
    membership.delete(peerId);
  })
  .on(PeerTrustUpdated, (membership, _, msg) => {
    const { peerId, trust } = msg.payload;
    crash.nonEmptyString(peerId, '_peer/trust_updated requires peerId');
    crash.ok(
      typeof trust === 'number' && trust >= 0,
      'trust must be number >= 0'
    );
    if (membership.has(peerId)) {
      membership.set(peerId, trust);
    }
  });

export function computeAuthorityOrder(peers: Record<string, number>): string[] {
  return Object.entries(peers)
    .sort((a, b) => {
      const trustDiff = b[1] - a[1];
      if (trustDiff !== 0) return trustDiff;
      return a[0].localeCompare(b[0]);
    })
    .map(([id]) => id);
}

export function membershipToRecord(m: Map<string, number>): Record<string, number> {
  return Object.fromEntries(m);
}

export function applyMembershipEvent(
  membership: Map<string, number>,
  event: Event
): void {
  membershipEventRouter.dispatch(membership, undefined, event, () => {});
}

export function rebuildMembershipFromLog(entries: LogEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const { event } of entries) {
    if (isSystemEvent(event)) {
      applyMembershipEvent(m, event);
    }
  }
  return m;
}

/** Materialize membership + domain state after applying all log rows with seq <= `seq`. */
export function materializeAtSeq(
  module: StoreModule,
  committed: LogEntry[],
  seq: number
): Snapshot {
  if (seq <= 0) {
    return {
      seq: 0,
      domainState: module.initialState(),
      membership: {},
    };
  }
  const slice = committed.filter((e) => e.seq <= seq);
  const membership = rebuildMembershipFromLog(slice);
  const domainState = replayDomainEntries(module, slice);
  return {
    seq,
    domainState,
    membership: membershipToRecord(membership),
  };
}
