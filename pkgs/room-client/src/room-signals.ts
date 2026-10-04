import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import { type Accessor, createMemo } from 'solid-js';

import type {
  LogEntry,
  RoomActor,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-shared/types';
import type { RoomClient } from './room-client';

/** The read/dispatch surface of {@link RoomClient} the bindings depend on. */
export type RoomReadable<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = Pick<
  RoomClient<S, C, E, unknown>,
  'getSnapshot' | 'subscribe' | 'getLog' | 'getRoster' | 'dispatch'
>;

const EMPTY_LOG: readonly LogEntry[] = Object.freeze([]);
const EMPTY_ROSTER: readonly RoomActor[] = Object.freeze([]);
/** Stable empty bag returned while `room() === null`. */
export const EMPTY_ROOM_STATE: Readonly<RoomState> = Object.freeze({});

/**
 * Subscribe to `read(room)` for whichever room the accessor currently yields.
 * Swapping rooms disposes the previous subscription; a `null` room reads
 * `empty`.
 */
function createRoomRead<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  T,
>(
  room: Accessor<RoomReadable<S, C, E> | null>,
  read: (room: RoomReadable<S, C, E>) => T,
  empty: T
): Accessor<T> {
  const source = createMemo<Accessor<T>>(() => {
    const current = room();
    if (current === null) return () => empty;
    return createSubscriptionSignal({
      getSnapshot: () => read(current),
      subscribe: (listener) => current.subscribe(listener),
    });
  });
  return () => source()();
}

/**
 * Solid read of a room's flat state. Reads `getSnapshot()` synchronously on
 * creation (so a `welcome` that arrived before mount is visible) and updates
 * on every `notify()`.
 */
export function createRoomSnapshot<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(room: Accessor<RoomReadable<S, C, E> | null>): Accessor<S> {
  return createRoomRead(
    room,
    (r) => r.getSnapshot(),
    EMPTY_ROOM_STATE as unknown as S
  );
}

/** Derived read over the room snapshot (Redux-style selector). */
export function createRoomSelector<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  R,
>(
  room: Accessor<RoomReadable<S, C, E> | null>,
  selector: (state: S) => R
): Accessor<R> {
  const snapshot = createRoomSnapshot(room);
  return createMemo(() => selector(snapshot()));
}

/** Committed event log (empty while `room() === null`). */
export function createRoomLog<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  room: Accessor<RoomReadable<S, C, E> | null>
): Accessor<readonly LogEntry<E>[]> {
  return createRoomRead(
    room,
    (r) => r.getLog(),
    EMPTY_LOG as readonly LogEntry<E>[]
  );
}

/** Live roster (empty while `room() === null`). */
export function createRoomRoster<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  room: Accessor<RoomReadable<S, C, E> | null>
): Accessor<readonly RoomActor[]> {
  return createRoomRead(room, (r) => r.getRoster(), EMPTY_ROSTER);
}

/**
 * Dispatch to the current room; no-op while `room() === null`. Commands sent
 * while disconnected are queued by the client and flushed on reconnect.
 */
export function createRoomDispatch<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(room: Accessor<RoomReadable<S, C, E> | null>): (payload: C) => void {
  return (payload) => {
    room()?.dispatch(payload);
  };
}
