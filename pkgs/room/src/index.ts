/**
 * `@pkgs/room` — server-authoritative sessions + optimistic client queue.
 *
 * This entrypoint exposes only the **core** client surface: the {@link RoomClient}
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
 * Server entry: `@pkgs/room/server`. Test helpers: `@pkgs/room/sim`
 * (re-exports from `./sim`).
 *
 * Adding a new transport (WebRTC, SSE, …) or storage backend (SQLite,
 * IndexedDB, …) means dropping a new folder under
 * `./client/adapters/{transport,storage}/` and re-exporting it via
 * `package.json` — the core engine stays untouched.
 */

export { createAttrNamespace } from '@pkgs/attribute';
export { asKeyword, assertKeywordRecord } from '@pkgs/keyword';
export {
  MAX_PENDING_OUTBOUND_COMMANDS,
  MAX_ROSTER_SIZE,
  MAX_WELCOME_ENTRIES_PER_FRAME,
} from './bounds';
export type { RoomClientConfig } from './client/core/room-client';
export { RoomClient } from './client/core/room-client';
export { RoomMetaAttr, roomAttrNamespace } from './client/core/room-meta';
export type { ClientRoomStorage, QueuedCommand } from './client/core/storage';
export type {
  ClientTransport,
  ClientTransportHandlers,
} from './client/core/transport';
export {
  type AnyRoomClient,
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
export {
  CancelScheduleEffect,
  ROOM_SCHEDULER_IDENTITY,
  ScheduleEffect,
  type ScheduleEffectPayload,
} from './effects/builtin';
export type {
  RoomEffectContext,
  RoomEffectHandler,
} from './effects/handler';
export { applyRoomEffects } from './effects/handler';
export {
  createScheduleEffectHandler,
  createTimerWakePort,
  fireDueSchedules,
  type PendingSchedule,
  ScheduleRuntime,
  type ScheduleWakePort,
} from './effects/schedule-runtime';
export {
  createTimerScheduleStack,
  type TimerScheduleStack,
} from './effects/timer-schedule-stack';
export {
  canonicalRoomJson,
  fnv1a64Hex,
  hashRoomState,
} from './hash-room-state';
export { newCommandId } from './protocol/ids';
export {
  type ClientToServerWire,
  parseClientToServerWire,
  parseServerToClientWire,
  ROOM_WIRE_KIND,
  type ServerToClientWire,
  WIRE_VERSION,
} from './protocol/wire';
export {
  TIGER_INVARIANTS,
  TIGER_MID_CHAOS_INVARIANTS,
  TIGER_POST_CONVERGE_INVARIANTS,
  type TigerInvariant,
} from './tiger-invariants';
export type {
  HandleResult,
  Keyword,
  LogEntry,
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomEffect,
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
