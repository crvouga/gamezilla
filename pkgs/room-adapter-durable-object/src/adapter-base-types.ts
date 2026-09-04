import type { Clock } from '@pkgs/clock';
import type {
  RoomCommandPayload,
  RoomEffectHandler,
  RoomEvent,
  RoomModule,
  RoomModuleName,
  RoomState,
} from '@pkgs/room';
import type { RoomStorage } from '@pkgs/room/server';
import type { CreateId } from '@pkgs/uuid';
import type { DurableObjectInstanceState } from './types';

/**
 * Resolved configuration handed to a {@link RoomDurableObjectAdapterBase}
 * instance. All defaults applied; no optional fields. Internal to the
 * adapter package.
 */
export type ResolvedAdapterConfig<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env,
> = {
  modulesByName: ReadonlyMap<RoomModuleName, RoomModule<S, C, E, Identity>>;
  identityHeader: string;
  clientIdHeader: string;
  parseIdentity: (raw: string) => Identity | null;
  createStorage: (
    state: DurableObjectInstanceState,
    env: Env,
    moduleName: RoomModuleName
  ) => RoomStorage;
  clock: Clock;
  createId: CreateId;
  /** Extra effect handlers composed after the built-in DO Schedule handler. */
  effectHandlers: readonly RoomEffectHandler[];
};
