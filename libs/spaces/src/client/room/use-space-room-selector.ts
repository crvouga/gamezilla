import {
  type RoomCommandPayload,
  type RoomState,
  useRoomDispatch,
  useRoomSelector,
} from '@pkgs/room';

import { SPACE_ROOM_MODULE_NAME } from '../../shared/space-room-module-name';

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
export function useSpaceRoomSelector<R>(selector: (state: RoomState) => R): R {
  return useRoomSelector(SPACE_ROOM_NAME, selector);
}

/**
 * Dispatch a command to the default space room (`{@link SPACE_ROOM_NAME}`).
 * Used by every game plugin to mutate room state through the same Room the
 * host has open.
 */
export function useSpaceRoomDispatch(): (payload: RoomCommandPayload) => void {
  return useRoomDispatch(SPACE_ROOM_NAME);
}
