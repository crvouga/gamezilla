/**
 * `@pkgs/room` — server-authoritative sessions + optimistic client queue.
 *
 * This entrypoint exposes only the **core** client surface: the {@link Room}
 * engine, its React binding, the wire protocol helpers, and the abstract
 * ports (`ClientTransport`, `ClientRoomStorage`) that any adapter must
 * satisfy. Adapters (browser WebSocket, in-memory storage, `localStorage`,
 * async key-value storage, etc.) live behind their own subpath imports so
 * callers explicitly opt in to a runtime/backend:
 *
 * - `@pkgs/room/client/adapters/transport/websocket` — browser WebSocket.
 * - `@pkgs/room/client/adapters/storage/memory` — in-process (tests).
 * - `@pkgs/room/client/adapters/storage/web` — synchronous `localStorage`.
 * - `@pkgs/room/client/adapters/storage/key-value` — async KV (web +
 *   React Native AsyncStorage).
 *
 * Server entry: `@pkgs/room/server`. Tests: `@pkgs/room/testkit`.
 *
 * Adding a new transport (WebRTC, SSE, …) or storage backend (SQLite,
 * IndexedDB, …) means dropping a new folder under
 * `./client/adapters/{transport,storage}/` and re-exporting it via
 * `package.json` — the core engine stays untouched.
 */

export { createAttrNamespace } from '@pkgs/attribute';
export { asKeyword, assertKeywordRecord } from '@pkgs/keyword';
export type { RoomClientConfig } from './client/core/room';
export { Room } from './client/core/room';
export { RoomMetaAttr, roomAttrNamespace } from './client/core/room-meta';
export type { ClientRoomStorage, QueuedCommand } from './client/core/storage';
export type {
  ClientTransport,
  ClientTransportHandlers,
} from './client/core/transport';
export {
  type AnyRoom,
  RoomClientsProvider,
  useRoomFromRegistry,
} from './client/react/room-clients-context';
export {
  useNamedRoomLog,
  useNamedRoomRoster,
  useRoomDispatch,
  useRoomSelector,
} from './client/react/use-room-registry-hooks';
export {
  EMPTY_ROOM_STATE,
  useRoomLog,
  useRoomRoster,
  useRoomSnapshot,
  useRoomSnapshotSelector,
} from './client/react/use-room-snapshot';
export { newCommandId } from './protocol/ids';
export {
  type ClientToServerWire,
  parseClientToServerWire,
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  type ServerToClientWire,
  WIRE_VERSION,
} from './protocol/wire';
export type {
  HandleResult,
  Keyword,
  LogEntry,
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomModuleName,
  RoomState,
} from './types';
export {
  assertRoomModuleName,
  parseRoomModuleName,
  ROOM_ERROR_TYPE,
  ROOM_ERROR_TYPES,
  ROOM_MODULE_NAME_REGEX,
} from './types';
