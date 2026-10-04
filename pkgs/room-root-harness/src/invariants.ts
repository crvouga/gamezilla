import type { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared/client-storage';
import type { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared/room-storage';
import type { RoomClient } from '@pkgs/room-root-client/room-client';
import type { RoomServer } from '@pkgs/room-root-server/room-server';
import type { TigerInvariant } from '@pkgs/room-root-shared/tiger-invariants';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { foldServerDomainState, serverDomainHash } from './wait-for-idle';

export type RoomInvariantViolation = {
  readonly invariant: TigerInvariant | string;
  readonly detail: string;
};

export type RoomClientInvariantSlot = {
  readonly key: string;
  readonly room: RoomClient<
    RoomState,
    RoomCommandPayload,
    RoomEvent,
    string
  > | null;
  readonly clientStorage: InMemoryClientStorage;
  readonly crashed: boolean;
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
 * Each committed dedup outcome's entries must appear in the log at those seqs.
 * Map storage already enforces one outcome per commandId.
 */
export async function checkCommandIdDedupStable(
  storage: InMemoryRoomStorage,
  topic: string
): Promise<RoomInvariantViolation | null> {
  const snap = storage.exportTopic(topic);
  if (snap === null || snap.dedup === undefined) return null;
  const bySeq = new Map(
    (await storage.loadEventsAfter(topic, 0)).map((e) => [e.seq, e])
  );
  for (const [commandId, outcome] of Object.entries(snap.dedup)) {
    if (outcome.kind !== 'committed') continue;
    for (const entry of outcome.entries) {
      const live = bySeq.get(entry.seq);
      if (live === undefined) {
        return {
          invariant: 'command-id-dedup-stable',
          detail: `commandId=${commandId} seq=${String(entry.seq)} missing from log`,
        };
      }
    }
  }
  return null;
}

/** Durable queue ids must match in-memory pending queue (ghost-queue detector). */
export async function checkDurableQueueMatchesMemory(
  slots: readonly RoomClientInvariantSlot[]
): Promise<RoomInvariantViolation | null> {
  for (const slot of slots) {
    if (slot.crashed || slot.room === null) continue;
    const durable = await slot.clientStorage.loadQueued();
    const memory = slot.room.getPendingQueueIds();
    const durableIds = durable.map((q) => q.id);
    if (
      durableIds.length !== memory.length ||
      durableIds.some((id, i) => id !== memory[i])
    ) {
      return {
        invariant: 'durable-queue-matches-memory',
        detail: `key=${slot.key} durable=[${durableIds.join(',')}] memory=[${memory.join(',')}]`,
      };
    }
  }
  return null;
}

/**
 * Per-step invariants (always true mid-chaos). Client hash equality is only
 * checked at settle after restoreNetwork.
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
  readonly clients?: readonly RoomClientInvariantSlot[];
}): Promise<RoomInvariantViolation | null> {
  void args.seed;
  const contig = await checkLogSeqContiguity(args.storage, args.topic);
  if (contig !== null) return contig;

  const dedup = await checkCommandIdDedupStable(args.storage, args.topic);
  if (dedup !== null) return dedup;

  if (args.clients !== undefined) {
    const queue = await checkDurableQueueMatchesMemory(args.clients);
    if (queue !== null) return queue;
  }

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
