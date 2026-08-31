import type { Assert } from '@pkgs/assert';
import { hotAssert } from '@pkgs/assert';
import { assertKeywordRecord } from '@pkgs/keyword';

import type {
  LogEntry,
  RoomCommand,
  RoomCommandPayload,
  RoomEffect,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../../types';
import { foldDisplay } from './room-fold';
import type { QueuedCommand } from './storage';

/** Apply a contiguous committed batch; assign log once so getLog sees one new ref. */
export function appendCommittedEntriesBatch<
  S extends RoomState,
  E extends RoomEvent,
>(args: {
  readonly module: RoomModule<S, RoomCommandPayload, E, unknown>;
  committedState: S;
  committedEntries: LogEntry<E>[];
  lastSeq: number;
  readonly entries: LogEntry<E>[];
}): {
  readonly committedState: S;
  readonly committedEntries: LogEntry<E>[];
  readonly lastSeq: number;
} {
  const a: Assert = hotAssert();
  let state = args.committedState;
  let lastSeq = args.lastSeq;
  const nextEntries = [...args.committedEntries];
  for (const e of args.entries) {
    a.ok(
      e.seq === lastSeq + 1,
      'log entries must extend lastSeq contiguously',
      { lastSeq, got: e.seq }
    );
    state = args.module.reduce(state, e.event);
    assertKeywordRecord(
      a,
      state as Record<string, unknown>,
      'room.appendCommittedEntries'
    );
    nextEntries.push(e);
    lastSeq = e.seq;
  }
  return {
    committedState: state,
    committedEntries: nextEntries,
    lastSeq,
  };
}

export type OptimisticRebuildResult<E extends RoomEvent> = {
  readonly optimistic: Map<string, E[]>;
  readonly effectsById: Map<string, readonly RoomEffect[]>;
};

/**
 * Rebuild optimistic overlays from the durable queue.
 * Folds the prefix incrementally (O(n) reduces, not O(n²) foldDisplay).
 */
export function rebuildOptimisticFromQueue<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(args: {
  readonly module: RoomModule<S, C, E, Identity>;
  readonly committed: S;
  readonly queue: QueuedCommand[];
  readonly identity: Identity;
}): OptimisticRebuildResult<E> {
  const optimistic = new Map<string, E[]>();
  const effectsById = new Map<string, readonly RoomEffect[]>();
  let display = args.committed;
  for (const q of args.queue) {
    const cmd: RoomCommand<C> = {
      id: q.id,
      ts: q.ts,
      payload: q.payload as C,
    };
    const res = args.module.handle(display, cmd, args.identity);
    if (res.ok) {
      optimistic.set(q.id, res.events);
      effectsById.set(q.id, res.effects ?? []);
      for (const e of res.events) {
        display = args.module.reduce(display, e);
      }
    }
  }
  return { optimistic, effectsById };
}

/** Display fold used by dispatch (prefix already in optimistic map). */
export function foldDispatchDisplay<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(
  module: RoomModule<S, C, E, Identity>,
  committed: S,
  queue: QueuedCommand[],
  optimistic: Map<string, E[]>
): S {
  return foldDisplay(module, committed, queue, optimistic);
}
