import { useCallback } from 'react';

import type {
  LogEntry,
  RoomActor,
  RoomCommandPayload,
  RoomState,
} from '../../types';
import { useRoomFromRegistry } from './room-clients-context';
import {
  useRoomLog,
  useRoomRoster,
  useRoomSnapshotSelector,
} from './use-room-snapshot';

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
 * Dispatch a command to the named room. No-ops when the room is missing.
 * Commands dispatched while disconnected are enqueued locally and flushed
 * automatically when the server connection is restored.
 */
export function useRoomDispatch(
  roomName: string
): (payload: RoomCommandPayload) => void {
  const room = useRoomFromRegistry(roomName);
  return useCallback(
    (payload: RoomCommandPayload) => {
      if (room === null) return;
      room.dispatch(payload);
    },
    [room]
  );
}

/** Committed event log for the named room (empty when unregistered). */
export function useNamedRoomLog(roomName: string): readonly LogEntry[] {
  const room = useRoomFromRegistry(roomName);
  return useRoomLog(room);
}

/** Live roster for the named room (empty when unregistered). */
export function useNamedRoomRoster(roomName: string): readonly RoomActor[] {
  const room = useRoomFromRegistry(roomName);
  return useRoomRoster(room);
}
