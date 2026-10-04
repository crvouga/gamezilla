import type { Clock } from '@pkgs/clock-shared/types';
import type { RoomEffectHandler } from '@pkgs/room-root-shared/handler';
import type { RoomServerConfig } from '@pkgs/room-root-shared/room-server-types';
import type { RoomStorage } from '@pkgs/room-root-shared/server-core-storage';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomModuleName,
  RoomState,
} from '@pkgs/room-root-shared/types';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import type {
  DurableObjectInstanceState,
  DurableObjectTelemetry,
} from './types';

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
  /** Header the gateway puts the connection's grants in. */
  grantsHeader: string;
  parseIdentity: (raw: string) => Identity | null;
  createStorage: (
    state: DurableObjectInstanceState,
    env: Env,
    moduleName: RoomModuleName
  ) => RoomStorage;
  clock: Clock;
  createId: CreateId;
  /** Per-command gate handed to every {@link RoomServer}; none when absent. */
  authorize: RoomServerConfig<S, C, E, Identity>['authorize'];
  /** Extra effect handlers composed after the built-in DO Schedule handler. */
  effectHandlers: readonly RoomEffectHandler[];
  telemetry: (env: Env) => DurableObjectTelemetry;
  serviceIdentity: Identity | null;
};
