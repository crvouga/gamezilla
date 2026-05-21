/**
 * Cloudflare Workers Durable Object adapter — production room hosting on
 * Workers. Subpath import: `@pkgs/room/server/adapters/durable-object`.
 *
 * The factory returns a DO class wired to the {@link RoomServer} engine
 * with a KV-backed {@link DurableObjectRoomStorage}. Bind it via
 * `class_name` in `wrangler.toml` and re-export it from the Worker entry
 * module so the runtime can instantiate it.
 */
export { createDurableObjectAdapter } from './adapter';
export type { CreateDurableObjectAdapterOptions } from './adapter';
export { DurableObjectRoomStorage } from './storage';
export type {
  DurableObjectClass,
  DurableObjectInstance,
  DurableObjectInstanceState,
  DurableObjectKvStorage,
} from './types';
