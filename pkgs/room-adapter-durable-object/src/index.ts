/**
 * Cloudflare Workers Durable Object adapter — production room hosting on
 * Workers. Subpath import: `@pkgs/room-adapter-durable-object`.
 *
 * The factory returns a DO class wired to the {@link RoomServer} engine
 * with a KV-backed {@link DurableObjectRoomStorage} (per-key log). Bind it via
 * `class_name` in `wrangler.toml` and re-export it from the Worker entry
 * module so the runtime can instantiate it.
 */

export type { CreateDurableObjectAdapterOptions } from './adapter';
export { createDurableObjectAdapter } from './adapter';
export { DurableObjectRoomStorage } from './storage';
export type {
  DurableObjectClass,
  DurableObjectInstance,
  DurableObjectInstanceState,
  DurableObjectKvStorage,
  DurableObjectTelemetry,
} from './types';
