/**
 * `@gamezilla/room` — server-authoritative sessions + optimistic client queue.
 *
 * This entrypoint exposes only the **core** client surface: the {@link Room}
 * engine, its React binding, the wire protocol helpers, and the abstract
 * ports (`ClientTransport`, `ClientRoomStorage`) that any adapter must
 * satisfy. Adapters (browser WebSocket, in-memory storage, `localStorage`,
 * async key-value storage, etc.) live behind their own subpath imports so
 * callers explicitly opt in to a runtime/backend:
 *
 * - `@gamezilla/room/client/adapters/transport/websocket` — browser WebSocket.
 * - `@gamezilla/room/client/adapters/storage/memory` — in-process (tests).
 * - `@gamezilla/room/client/adapters/storage/web` — synchronous `localStorage`.
 * - `@gamezilla/room/client/adapters/storage/key-value` — async KV (web +
 *   React Native AsyncStorage).
 *
 * Server entry: `@gamezilla/room/server`. Tests: `@gamezilla/room/testkit`.
 *
 * Adding a new transport (WebRTC, SSE, …) or storage backend (SQLite,
 * IndexedDB, …) means dropping a new folder under
 * `./client/adapters/{transport,storage}/` and re-exporting it via
 * `package.json` — the core engine stays untouched.
 */
export { Room } from './client/core/room';
export type { RoomClientConfig } from './client/core/room';
export { roomAttrNamespace, RoomMetaAttr } from './client/core/room-meta';
export type { ClientRoomStorage, QueuedCommand } from './client/core/storage';
export type {
  ClientTransport,
  ClientTransportHandlers,
} from './client/core/transport';
export {
  RoomClientsProvider,
  useRoomFromRegistry,
  type AnyRoom,
} from './client/react/room-clients-context';
export {
  useRoomDispatch,
  useRoomSelector,
} from './client/react/use-room-registry-hooks';
export {
  useRoomSnapshot,
  useRoomSnapshotSelector,
} from './client/react/use-room-snapshot';
export { newCommandId } from './protocol/ids';
export { createAttrNamespace } from '@gamezilla/lib/attribute';
export { asKeyword, assertKeywordRecord } from '@gamezilla/lib/keyword';
export {
  parseClientToServerWire,
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  WIRE_VERSION,
  type ClientToServerWire,
  type ServerToClientWire,
} from './protocol/wire';
export {
  assertRoomModuleName,
  parseRoomModuleName,
  ROOM_ERROR_TYPE,
  ROOM_ERROR_TYPES,
  ROOM_MODULE_NAME_REGEX,
} from './types';
export type {
  HandleResult,
  Keyword,
  LogEntry,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomModuleName,
  RoomState,
} from './types';
