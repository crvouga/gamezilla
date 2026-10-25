import type {
  ClientRoomStorage,
  QueuedCommand,
} from '@pkgs/room-root-shared-ts/core-storage';
import type { LogEntry } from '@pkgs/room-root-shared-ts/types';

/**
 * Write-behind persistence for {@link RoomClient}.
 *
 * In-memory state is always applied synchronously; durable writes are
 * coalesced onto one serial promise chain so (a) storage never sees two
 * operations in flight, (b) a burst of frames in one tick costs one write per
 * kind, and (c) an ack can never race ahead of a queue persist (the durable
 * queue is always a snapshot of the in-memory queue at flush time — no ghost
 * rows).
 */
export type RoomClientPersist = {
  readonly appendCommitted: (entries: readonly LogEntry[]) => void;
  readonly resetCommitted: () => void;
  readonly queueChanged: () => void;
  /** Resolves once every write scheduled so far has completed (tests / flush). */
  readonly flush: () => Promise<void>;
  /** Other bounded storage operations share the queue/log serial chain. */
  readonly run: <T>(
    work: () => Promise<T>,
    kind: 'read' | 'write'
  ) => Promise<T>;
};

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export function createRoomClientPersist(args: {
  readonly storage: ClientRoomStorage;
  readonly readQueue: () => readonly QueuedCommand[];
  readonly onError: (err: Error) => void;
}): RoomClientPersist {
  const { storage } = args;
  let chain: Promise<void> = Promise.resolve();
  let scheduled = false;
  let resetPending = false;
  let appendPending: LogEntry[] = [];
  let queueDirty = false;
  let failure: Error | null = null;
  let writeFailure: Error | null = null;

  const run = async (): Promise<void> => {
    scheduled = false;
    const doReset = resetPending;
    const batch = appendPending;
    const doQueue = queueDirty;
    resetPending = false;
    appendPending = [];
    queueDirty = false;
    if (doReset) await storage.resetCommitted();
    if (batch.length > 0) await storage.appendCommitted(batch);
    if (doQueue) await storage.saveQueued(args.readQueue().slice());
    failure = null;
    writeFailure = null;
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    chain = chain.then(run).catch((err: unknown) => {
      failure = toError(err);
      writeFailure = failure;
      args.onError(failure);
    });
  };

  const serialize = <T>(
    work: () => Promise<T>,
    kind: 'read' | 'write'
  ): Promise<T> => {
    const result = chain.then(() => {
      if (kind === 'write' && writeFailure !== null) throw writeFailure;
      return work();
    });
    chain = result.then(
      () => {
        failure = writeFailure;
      },
      (err: unknown) => {
        const error = toError(err);
        if (error !== failure) args.onError(error);
        failure = error;
        if (kind === 'write') writeFailure = error;
      }
    );
    return result;
  };

  return {
    appendCommitted: (entries) => {
      for (let i = 0; i < entries.length; i++) appendPending.push(entries[i]!);
      schedule();
    },
    resetCommitted: () => {
      resetPending = true;
      appendPending = [];
      schedule();
    },
    queueChanged: () => {
      queueDirty = true;
      schedule();
    },
    flush: async () => {
      let observed: Promise<void>;
      do {
        observed = chain;
        await observed;
      } while (observed !== chain);
      if (failure !== null) throw failure;
    },
    run: serialize,
  };
}
