/**
 * `@gamezilla/room/server` — runtime-agnostic room engine + interfaces.
 *
 * This entrypoint exposes only the **core** server surface: the
 * authoritative {@link RoomServer} engine and the abstract ports
 * (`RoomStorage`, `RoomAuth`) that any adapter must satisfy. Adapters
 * (Cloudflare Durable Objects, in-memory, etc.) live behind their own
 * subpath imports so callers explicitly opt in to a runtime/backend:
 *
 * - `@gamezilla/room/server/adapters/durable-object` — production hosting
 *   on Cloudflare Workers (DO class factory + KV-backed storage).
 * - `@gamezilla/room/server/adapters/memory` — volatile in-process
 *   storage for tests and the loopback testkit.
 *
 * Adding a new runtime (Node/Bun HTTP server, Postgres-backed storage,
 * etc.) means dropping a new folder under `./server/adapters/` and
 * re-exporting it via `package.json` — the core engine stays untouched.
 */
export type {
  RoomAuth,
  RoomAuthFailure,
  RoomAuthResult,
  RoomAuthSuccess,
} from './server/core/auth';
export { RoomServer } from './server/core/room-server';
export type { RoomServerConfig } from './server/core/room-server';
export type { RoomStorage, CommandDedupOutcome } from './server/core/storage';
