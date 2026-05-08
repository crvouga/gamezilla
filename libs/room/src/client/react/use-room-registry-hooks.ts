import { useCallback } from 'react';

import type { RoomState } from '../../types';
import { RoomMetaAttr } from '../core/room-meta';
import { useRoomFromRegistry } from './room-clients-context';
import { useRoomSnapshotSelector } from './use-room-snapshot';

/**
 * Read derived state from the named room (Redux-style selector). Uses an empty
 * `RoomState` when that room is not registered so parsers yield defaults.
 */
export function useRoomSelector<R>(
  roomName: string,
  selector: (state: RoomState) => R
): R {
  const room = useRoomFromRegistry(roomName);
  return useRoomSnapshotSelector(room, selector);
}

/**
 * Dispatch a command to the named room. No-ops when the room is missing or
 * not yet synced (same guard as typical space UI controls).
 */
export function useRoomDispatch(roomName: string): (payload: unknown) => void {
  const room = useRoomFromRegistry(roomName);
  return useCallback(
    (payload: unknown) => {
      if (room === null) return;
      if (!RoomMetaAttr.isSynced.from(room.getSnapshot())) return;
      room.dispatch(payload);
    },
    [room]
  );
}
