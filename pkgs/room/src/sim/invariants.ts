import type { InMemoryRoomStorage } from '../server/adapters/memory';
import type { RoomServer } from '../server/core/room-server';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import { foldServerDomainState, serverDomainHash } from './settle';

export type RoomInvariantViolation = {
  readonly invariant: string;
  readonly detail: string;
};

/** Storage log seqs must be contiguous starting at 1 (or empty). */
export async function checkLogSeqContiguity(
  storage: InMemoryRoomStorage,
  topic: string
): Promise<RoomInvariantViolation | null> {
  const entries = await storage.loadEventsAfter(topic, 0);
  let expect = 1;
  for (const e of entries) {
    if (e.seq !== expect) {
      return {
        invariant: 'log-seq-contiguity',
        detail: `expect ${String(expect)} got ${String(e.seq)}`,
      };
    }
    expect += 1;
  }
  return null;
}

/**
 * Per-step invariants (always true mid-chaos). Client hash equality is only
 * checked at settle after heal.
 */
export async function checkRoomInvariants<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(args: {
  readonly module: RoomModule<S, C, E, string>;
  readonly storage: InMemoryRoomStorage;
  readonly topic: string;
  readonly server: RoomServer<S, C, E, string>;
  readonly seed: bigint;
}): Promise<RoomInvariantViolation | null> {
  void args.seed;
  const contig = await checkLogSeqContiguity(args.storage, args.topic);
  if (contig !== null) return contig;

  try {
    const logHash = await serverDomainHash({
      module: args.module,
      storage: args.storage,
      topic: args.topic,
    });
    const liveHash = args.module.hash(args.server.getCommittedState());
    if (liveHash !== logHash) {
      return {
        invariant: 'live-vs-log',
        detail: `live=${liveHash} log=${logHash}`,
      };
    }
    await foldServerDomainState({
      module: args.module,
      storage: args.storage,
      topic: args.topic,
    });
  } catch (err) {
    return {
      invariant: 'live-vs-log',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  return null;
}
