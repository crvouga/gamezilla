/**
 * `@pkgs/room/server` — runtime-agnostic room engine + interfaces.
 *
 * This entrypoint exposes only the **core** server surface: the
 * authoritative {@link RoomServer} engine and the abstract ports
 * (`RoomStorage`, `RoomAuth`) that any adapter must satisfy. Adapters
 * (Cloudflare Durable Objects, in-memory, etc.) live in their own packages
 * so callers explicitly opt in to a runtime/backend:
 *
 * - `@pkgs/room-adapter-durable-object` — production hosting
 *   on Cloudflare Workers (DO class factory + KV-backed storage).
 * - `@pkgs/room-adapter-memory` — volatile in-process
 *   storage for tests and the loopback testkit.
 *
 * Adding a new runtime (Node/Bun HTTP server, Postgres-backed storage,
 * etc.) means dropping a new `@pkgs/room-adapter-*` package — the core
 * engine stays untouched.
 */

export {
  CancelScheduleEffect,
  ROOM_SCHEDULER_IDENTITY,
  ScheduleEffect,
} from './effects/builtin';
export type {
  RoomEffectContext,
  RoomEffectHandler,
} from './effects/handler';
export type {
  RoomAuth,
  RoomAuthFailure,
  RoomAuthResult,
  RoomAuthSuccess,
} from './server/core/auth';
export {
  decodeRoomGrants,
  encodeRoomGrants,
  ROOM_GRANTS_HEADER,
} from './server/core/grants-header';
export { handleRoomService } from './server/core/handle-room-service';
export type {
  RoomConnection,
  RoomConnectionOptions,
  RoomServerConfig,
} from './server/core/room-server';
export { RoomServer } from './server/core/room-server';
export type {
  RoomIdentityErasure,
  RoomServicePort,
} from './server/core/room-service';
export { eraseRoomIdentity } from './server/core/room-service';
export type { CommandDedupOutcome, RoomStorage } from './server/core/storage';
export { ROOM_SERVICE_GRANT, ROOM_SERVICE_IDENTITY } from './service-identity';
export type { LogEntry, RoomActor, RoomEffect } from './types';
