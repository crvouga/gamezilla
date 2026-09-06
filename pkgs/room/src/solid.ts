/**
 * `@pkgs/room/solid` — Solid bindings for {@link RoomClient}: snapshot / log /
 * roster signals plus a named-room registry context.
 */
export {
  type AnyRoomClient,
  type RoomClientRegistry,
  RoomClientsProvider,
  type RoomClientsProviderProps,
  useNamedRoomLog,
  useNamedRoomRoster,
  useRoomDispatch,
  useRoomFromRegistry,
  useRoomSelector,
} from './client/solid/room-clients-context';
export {
  createRoomDispatch,
  createRoomLog,
  createRoomRoster,
  createRoomSelector,
  createRoomSnapshot,
  EMPTY_ROOM_STATE,
  type RoomReadable,
} from './client/solid/room-signals';
