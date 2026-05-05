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
export type {
  HandleResult,
  LogEntry,
  RoomCommand,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from './types';
export { WIRE_VERSION } from './protocol/wire';
export {
  parseClientToServerWire,
  parseServerToClientWire,
  type ClientToServerWire,
  type ServerToClientWire,
} from './protocol/wire';
export { newCommandId } from './protocol/ids';
export { Room } from './client/core/room';
export type { RoomClientConfig, RoomSnapshot } from './client/core/room';
export { useRoomSnapshot } from './client/core/use-room-snapshot';
export type {
  ClientTransport,
  ClientTransportHandlers,
} from './client/core/transport';
export type { ClientRoomStorage, QueuedCommand } from './client/core/storage';
