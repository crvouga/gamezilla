/**
 * `@pkgs/room` — server-authoritative sessions + optimistic client queue.
 *
 * This entrypoint exposes only the **core** client surface: the {@link RoomClient}
 * engine, the wire protocol helpers, and the abstract
 * ports (`ClientTransport`, `ClientRoomStorage`) that any adapter must
 * satisfy. Adapters (browser WebSocket, in-memory storage, `localStorage`,
 * async key-value storage, etc.) live in their own packages so callers
 * explicitly opt in to a runtime/backend:
 *
 * - `@pkgs/room-adapter-web` — browser WebSocket + `localStorage`.
 * - `@pkgs/room-adapter-memory` — in-process storage + loopback transport.
 * - `@pkgs/room/client/adapters/storage/key-value` - async KV storage.
 *
 * Solid bindings: `@pkgs/room/solid`. Server: `@pkgs/room/server`.
 * Test helpers: `@pkgs/room-harness`.
 *
 * Adding a new transport (WebRTC, SSE, …) or storage backend (SQLite,
 * IndexedDB, …) means dropping a new `@pkgs/room-adapter-*` package —
 * the core engine stays untouched.
 */

export { createAttrNamespace } from '@pkgs/attribute';
export { asKeyword, assertKeywordRecord } from '@pkgs/keyword';
export {
  MAX_PENDING_OUTBOUND_COMMANDS,
  MAX_ROSTER_SIZE,
  MAX_WELCOME_ENTRIES_PER_FRAME,
} from './bounds';
export type {
  RoomClientConfig,
  RoomCommandResult,
} from './client/core/room-client';
export { RoomClient } from './client/core/room-client';
export { RoomMetaAttr, roomAttrNamespace } from './client/core/room-meta';
export type { ClientRoomStorage, QueuedCommand } from './client/core/storage';
export type {
  ClientTransport,
  ClientTransportHandlers,
} from './client/core/transport';
export {
  COMMITTED_LOG_SEGMENT_SIZE,
  type CommittedLogBlobs,
  type CommittedLogManifest,
  createSegmentedCommittedLog,
  type SegmentedCommittedLog,
} from './client/storage/segmented-committed-log';
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
export { plainDeepEqual } from './plain-deep-equal';
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
