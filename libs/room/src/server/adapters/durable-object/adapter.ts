import type { RoomModule, RoomState } from '../../../types';
import type { RoomStorage } from '../../core/storage';

import {
  RoomDurableObjectAdapterBase,
  type ResolvedAdapterConfig,
} from './adapter-base';
import { DurableObjectRoomStorage } from './storage';
import {
  type DurableObjectClass,
  type DurableObjectInstanceState,
} from './types';

const DEFAULT_IDENTITY_HEADER = 'x-gamezilla-account-id' as const;

export type CreateDurableObjectAdapterOptions<
  S extends RoomState,
  C,
  E,
  Identity,
  Env = unknown,
> = {
  /** Domain reducer + command handler for one room/topic. */
  module: RoomModule<S, C, E, Identity>;
  /**
   * HTTP header that carries the authenticated identity for this upgrade.
   * The route layer in front of the DO is expected to populate it.
   * Defaults to `x-gamezilla-account-id`.
   */
  identityHeader?: string;
  /**
   * Coerce the trimmed header value into the module's `Identity` type.
   * Return `null` to reject the upgrade with HTTP 401. Defaults to passing
   * the trimmed string through when non-empty (only valid when the module's
   * `Identity` is `string`).
   */
  parseIdentity?: (raw: string) => Identity | null;
  /**
   * Override storage construction (mainly for tests / alternative
   * persistence). Defaults to {@link DurableObjectRoomStorage} backed by
   * the DO's KV `storage` binding.
   */
  createStorage?: (state: DurableObjectInstanceState, env: Env) => RoomStorage;
};

function defaultParseIdentity<Identity>(raw: string): Identity | null {
  if (raw.length === 0) return null;
  return raw as unknown as Identity;
}

function resolveOptions<S extends RoomState, C, E, Identity, Env>(
  options: CreateDurableObjectAdapterOptions<S, C, E, Identity, Env>
): ResolvedAdapterConfig<S, C, E, Identity, Env> {
  return {
    module: options.module,
    identityHeader: options.identityHeader ?? DEFAULT_IDENTITY_HEADER,
    parseIdentity: options.parseIdentity ?? defaultParseIdentity<Identity>,
    createStorage:
      options.createStorage ??
      ((state) => new DurableObjectRoomStorage(state.storage)),
  };
}

/**
 * Returns a Cloudflare Durable Object class that hosts one
 * {@link RoomDurableObjectAdapterBase | room server} per topic, mediates
 * WebSocket upgrades, and persists the committed log via the DO's KV
 * `storage` binding.
 *
 * The returned class is the value you bind to `class_name` in
 * `wrangler.toml` — re-export it from your Worker entry module so the
 * Workers runtime can instantiate it. One adapter per domain module;
 * multiple bindings can co-exist in the same Worker.
 *
 * @example
 * ```ts
 * // apps/api/src/rooms/space-do.ts
 * import { SpaceModule } from '@gamezilla/domain/spaces/space-module';
 * import { createDurableObjectAdapter } from '@gamezilla/room/server/adapters/durable-object';
 *
 * export default createDurableObjectAdapter({ module: SpaceModule });
 * ```
 */
export function createDurableObjectAdapter<
  S extends RoomState,
  C,
  E,
  Identity,
  Env = unknown,
>(
  options: CreateDurableObjectAdapterOptions<S, C, E, Identity, Env>
): DurableObjectClass<Env> {
  const config = resolveOptions(options);
  return class RoomDurableObjectAdapter extends RoomDurableObjectAdapterBase<
    S,
    C,
    E,
    Identity,
    Env
  > {
    constructor(ctx: DurableObjectInstanceState, env: Env) {
      super(ctx, env, config);
    }
  };
}
