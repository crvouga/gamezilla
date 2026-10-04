import type { RoomCommandPayload, RoomState } from '@pkgs/room-shared/types';
import { useRoomDispatch, useRoomSelector } from '@pkgs/room-client/room-clients-context';
import type { Accessor } from 'solid-js';

import { SPACE_ROOM_MODULE_NAME } from '@libs/spaces-shared/space-room-module-name';
import { useSpaceOpenRooms } from './space-open-rooms-store';
import { useSpaceRoomSessionId } from './space-room-context';

/**
 * Registry key for the primary collaborative room in a space session.
 *
 * Colocated with the `useSpaceRoom*` hooks so the `@pkgs/room` engine
 * stays domain-agnostic (it knows nothing about "spaces"). Every game plugin
 * that wants to read or dispatch on the space room reaches in via the hooks
 * below, never via this literal directly.
 */
export const SPACE_ROOM_NAME = SPACE_ROOM_MODULE_NAME;

/**
 * Select from the default space room (`{@link SPACE_ROOM_NAME}`). Use this in
 * any game plugin (chess, future games) that participates in the host's
 * space session — chess gets its own slice of state via its room namespace
 * but reads it through this hook.
 */
export function useSpaceRoomSelector<R>(
  selector: (state: RoomState) => R
): Accessor<R> {
  return useRoomSelector(SPACE_ROOM_NAME, selector);
}

/**
 * Dispatch a command to the default space room (`{@link SPACE_ROOM_NAME}`).
 * Routes through the open-rooms registry so commands issued while the local
 * Room is still hydrating are buffered and flushed on commit (offline-first /
 * Connecting… safe). Falls back to the registry when no session id.
 */
export function useSpaceRoomDispatch(): (payload: RoomCommandPayload) => void {
  const spaceId = useSpaceRoomSessionId();
  const openRooms = useSpaceOpenRooms();
  const registryDispatch = useRoomDispatch(SPACE_ROOM_NAME);
  return (payload: RoomCommandPayload) => {
    const id = spaceId();
    if (id !== null && id.length > 0) {
      openRooms.dispatch(id, payload);
      return;
    }
    registryDispatch(payload);
  };
}
