import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import {
  assertRoomModuleName,
  type RoomCommandPayload,
  type RoomEffectHandler,
  type RoomEvent,
  type RoomModule,
  type RoomModuleName,
  type RoomState,
} from '@pkgs/room';
import {
  ROOM_GRANTS_HEADER,
  type RoomServerConfig,
  type RoomStorage,
} from '@pkgs/room/server';
import type { CreateId } from '@pkgs/uuid';

import {
  type ResolvedAdapterConfig,
  RoomDurableObjectAdapterBase,
} from './adapter-base';
import { DurableObjectRoomStorage } from './storage';
import type {
  DurableObjectClass,
  DurableObjectInstanceState,
  DurableObjectTelemetry,
} from './types';

const DEFAULT_IDENTITY_HEADER = 'x-actor-id' as const;
const DEFAULT_CLIENT_ID_HEADER = 'x-actor-client-id' as const;

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
   * HTTP header that carries the per-tab / per-app-instance client id.
   * Defaults to `x-actor-client-id`. When missing or empty the adapter mints
   * a fresh UUID for the connection.
   */
  clientIdHeader?: string;
  /**
   * Coerce the trimmed header value into the module's `Identity` type.
   * Return `null` to reject the upgrade with HTTP 401. Defaults to passing
   * the trimmed string through when non-empty (only valid when the module's
   * `Identity` is `string`).
   */
  parseIdentity?: (raw: string) => Identity | null;
  /**
   * HTTP header carrying the grants the route layer decided for this
   * connection (comma-separated; see `encodeRoomGrants`). The route layer
   * must set it and strip any client-supplied value. Defaults to
   * `x-actor-grants`; absent means no grants.
   */
  grantsHeader?: string;
  /**
   * Per-command gate for every hosted room, handed the connection's grants
   * (see `RoomServerConfig.authorize`). No gate when omitted.
   */
  authorize?: RoomServerConfig<S, C, E, Identity>['authorize'];
  /**
   * Override storage construction (mainly for tests / alternative
   * persistence). Defaults to {@link DurableObjectRoomStorage} backed by
   * the DO's KV `storage` binding (per-event / per-dedup keys per module).
   */
  createStorage?: (
    state: DurableObjectInstanceState,
    env: Env,
    moduleName: RoomModuleName
  ) => RoomStorage;
  /** Injectable clock (required — no wall default). */
  clock: Clock;
  /** Injectable id mint (required — no wall default). */
  createId: CreateId;
  /** Extra effect handlers after the built-in DO Schedule/CancelSchedule handler. */
  effectHandlers?: readonly RoomEffectHandler[];
  /** Resolve the OTel runtime from the concrete Worker's environment bindings. */
  telemetry: (env: Env) => DurableObjectTelemetry;
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
    clientIdHeader: options.clientIdHeader ?? DEFAULT_CLIENT_ID_HEADER,
    grantsHeader: options.grantsHeader ?? ROOM_GRANTS_HEADER,
    parseIdentity: options.parseIdentity ?? defaultParseIdentity<Identity>,
    createStorage:
      options.createStorage ??
      ((state, _env, moduleName) =>
        new DurableObjectRoomStorage(state.storage, moduleName)),
    clock: options.clock,
    createId: options.createId,
    authorize: options.authorize,
    effectHandlers: options.effectHandlers ?? [],
    telemetry: options.telemetry,
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
 * // your-api-worker/src/api.ts
 * import { APP_ROOM_MODULES } from './shared/rooms';
 * import { createDurableObjectAdapter } from '@pkgs/room-adapter-durable-object';
 *
 * export const RoomServerDurableObject = createDurableObjectAdapter({
 *   modules: APP_ROOM_MODULES,
 *   clock,
 *   createId,
 * });
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
