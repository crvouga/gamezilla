import type { Assert } from '@pkgs/assert';
import { hotAssert } from '@pkgs/assert';
import { assertKeywordRecord } from '@pkgs/keyword';

import type {
  LogEntry,
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../../types';
import type { QueuedCommand } from './storage';

export function foldEntries<S extends RoomState, E extends RoomEvent>(
  module: RoomModule<S, RoomCommandPayload, E, unknown>,
  entries: LogEntry<E>[]
): { state: S; lastSeq: number } {
  let state = module.initialState();
  let lastSeq = 0;
  const a: Assert = hotAssert();
  for (const e of entries) {
    state = module.reduce(state, e.event);
    assertKeywordRecord(
      a,
      state as Record<string, unknown>,
      'room.foldEntries'
    );
    lastSeq = e.seq;
  }
  return { state, lastSeq };
}

export function foldDisplay<
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
  let s = committed;
  const a: Assert = hotAssert();
  for (const q of queue) {
    const ev = optimistic.get(q.id);
    if (ev === undefined) continue;
    for (const e of ev) {
      s = module.reduce(s, e);
      assertKeywordRecord(a, s as Record<string, unknown>, 'room.foldDisplay');
    }
  }
  return s;
}
