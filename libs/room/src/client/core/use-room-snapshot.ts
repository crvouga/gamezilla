import { useCallback, useSyncExternalStore } from 'react';

import type { Room, RoomSnapshot } from './room';
import type { RoomState } from '../../types';

const noop = (): void => {};

/**
 * React-friendly read of {@link Room}. Built on `useSyncExternalStore` so:
 * - The first render reads the current `getSnapshot()` synchronously, even if
 *   `welcome` arrived before this component mounted.
 * - Every `notify()` triggers a re-render with a fresh snapshot reference.
 * - Concurrent React stays tearing-free.
 *
 * Pass `room === null` while the connection is being constructed; the hook
 * returns `null` until a Room is provided.
 */
export function useRoomSnapshot<S extends RoomState, C, E, Identity>(
  room: Room<S, C, E, Identity> | null
): RoomSnapshot<S> | null {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      if (room === null) return noop;
      return room.subscribe(listener);
    },
    [room]
  );
  const getSnapshot = useCallback(
    (): RoomSnapshot<S> | null => (room === null ? null : room.getSnapshot()),
    [room]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
