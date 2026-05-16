import { assert } from '@gamezilla/lib/assert';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomModuleName,
  RoomState,
} from '../../../types';
import { assertRoomModuleName } from '../../../types';
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

const DEFAULT_IDENTITY_HEADER = 'x-actor-id' as const;

export type CreateDurableObjectAdapterOptions<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env = unknown,
> = {
  /**
   * Room modules hosted by this DO class. Each module's `name` field must be
   * unique, match `^[a-z]+(?:-[a-z]+)*$` (see {@link assertRoomModuleName}),
   * and appear as the `module` query param on WebSocket upgrade requests.
   */
  modules: readonly RoomModule<S, C, E, Identity>[];
  /**
   * HTTP header that carries the authenticated identity for this upgrade.
   * The route layer in front of the DO is expected to populate it.
   * Defaults to `x-actor-id`.
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
   * the DO's KV `storage` binding (one persisted blob per `moduleName`).
   */
  createStorage?: (
    state: DurableObjectInstanceState,
    env: Env,
    moduleName: RoomModuleName
  ) => RoomStorage;
};

function defaultParseIdentity<Identity>(raw: string): Identity | null {
  if (raw.length === 0) return null;
  return raw as unknown as Identity;
}

function resolveOptions<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env,
>(
  options: CreateDurableObjectAdapterOptions<S, C, E, Identity, Env>
): ResolvedAdapterConfig<S, C, E, Identity, Env> {
  const { modules } = options;
  assert.nonEmptyArray(
    modules,
    'createDurableObjectAdapter: `modules` must be a non-empty array of RoomModule values'
  );
  const seen = new Set<RoomModuleName>();
  const modulesByName = new Map<
    RoomModuleName,
    RoomModule<S, C, E, Identity>
  >();
  for (const mod of modules) {
    const name = assertRoomModuleName(String(mod.name));
    if (seen.has(name)) {
      assert.fail(
        `createDurableObjectAdapter: duplicate module name ${JSON.stringify(name)}`
      );
    }
    seen.add(name);
    modulesByName.set(name, mod);
  }
  return {
    modulesByName,
    identityHeader: options.identityHeader ?? DEFAULT_IDENTITY_HEADER,
    parseIdentity: options.parseIdentity ?? defaultParseIdentity<Identity>,
    createStorage:
      options.createStorage ??
      ((state, _env, moduleName) =>
        new DurableObjectRoomStorage(state.storage, moduleName)),
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
 * Workers runtime can instantiate it. Pass multiple named `modules` when one
 * DO class should host several reducers; the client picks one via the
 * required `module` query param (lowercase kebab-case; pattern
 * `^[a-z]+(?:-[a-z]+)*$` via {@link assertRoomModuleName}).
 *
 * @example
 * ```ts
 * // packages/api/src/api.ts
 * import { APP_ROOM_MODULES } from '@gamezilla/app/shared/games';
 * import { createDurableObjectAdapter } from '@gamezilla/room/server/adapters/durable-object';
 *
 * export const Room = createDurableObjectAdapter({ modules: APP_ROOM_MODULES });
 * ```
 */
export function createDurableObjectAdapter<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
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
