import { useCallback, useSyncExternalStore } from 'react';

import type {
  LogEntry,
  RoomActor,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '../../types';
import type { RoomClient } from '../core/room-client';

const noop = (): void => {};

const EMPTY_LOG: readonly LogEntry[] = Object.freeze([]);
const EMPTY_ROSTER: readonly RoomActor[] = Object.freeze([]);
/** Stable empty bag for `useSyncExternalStore` when `room === null`. */
export const EMPTY_ROOM_STATE: Readonly<RoomState> = Object.freeze({});

/**
 * React-friendly read of {@link RoomClient}. Built on `useSyncExternalStore` so:
 * - The first render reads the current `getSnapshot()` synchronously, even if
 *   `welcome` arrived before this component mounted.
 * - Every `notify()` triggers a re-render with a fresh snapshot reference.
 * - Concurrent React stays tearing-free.
 *
 * When `room === null`, returns an empty frozen state so selectors can run
 * with parser defaults.
 */
export function useRoomSnapshot<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(room: RoomClient<S, C, E, Identity> | null): S {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      if (room === null) return noop;
      return room.subscribe(listener);
    },
    [room]
  );
  const getSnapshot = useCallback(
    (): S =>
      room === null ? (EMPTY_ROOM_STATE as unknown as S) : room.getSnapshot(),
    [room]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Select from flat room state. When `room === null`, reads an empty bag.
 */
export function useRoomSnapshotSelector<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  R,
>(room: RoomClient<S, C, E, Identity> | null, selector: (state: S) => R): R {
  const state = useRoomSnapshot(room);
  return selector(state);
}

/** Committed event log from a room (empty when `room === null`). */
export function useRoomLog<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(room: RoomClient<S, C, E, Identity> | null): readonly LogEntry<E>[] {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      if (room === null) return noop;
      return room.subscribe(listener);
    },
    [room]
  );
  const getSnapshot = useCallback(
    (): readonly LogEntry<E>[] =>
      room === null ? (EMPTY_LOG as readonly LogEntry<E>[]) : room.getLog(),
    [room]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Live roster snapshot from a room (empty when `room === null`). */
export function useRoomRoster<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(room: RoomClient<S, C, E, Identity> | null): readonly RoomActor[] {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      if (room === null) return noop;
      return room.subscribe(listener);
    },
    [room]
  );
  const getSnapshot = useCallback(
    (): readonly RoomActor[] =>
      room === null ? EMPTY_ROSTER : room.getRoster(),
    [room]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
