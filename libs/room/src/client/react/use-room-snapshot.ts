import { useCallback, useSyncExternalStore } from 'react';

import type { RoomCommandPayload, RoomEvent, RoomState } from '../../types';
import type { Room } from '../core/room';

const noop = (): void => {};

/** Stable empty bag for `useSyncExternalStore` when `room === null`. */
export const EMPTY_ROOM_STATE: Readonly<RoomState> = Object.freeze({});

/**
 * React-friendly read of {@link Room}. Built on `useSyncExternalStore` so:
 * - The first render reads the current `getSnapshot()` synchronously, even if
 *   `welcome` arrived before this component mounted.
 * - Every `notify()` triggers a re-render with a fresh snapshot reference.
 * - Concurrent React stays tearing-free.
 *
 * When `room === null`, returns {@link EMPTY_ROOM_STATE} so selectors can run
 * with parser defaults.
 */
export function useRoomSnapshot<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
>(room: Room<S, C, E, Identity> | null): S {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      if (room === null) return noop;
      return room.subscribe(listener);
    },
    [room]
  );
  const getSnapshot = useCallback(
    (): S => (room === null ? (EMPTY_ROOM_STATE as S) : room.getSnapshot()),
    [room]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Select from flat room state. When `room === null`, reads {@link EMPTY_ROOM_STATE}.
 */
export function useRoomSnapshotSelector<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  R,
>(room: Room<S, C, E, Identity> | null, selector: (state: S) => R): R {
  const state = useRoomSnapshot(room);
  return selector(state);
}
