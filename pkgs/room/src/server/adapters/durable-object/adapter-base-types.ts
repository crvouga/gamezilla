import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomModuleName,
  RoomState,
} from '../../../types';
import type { RoomStorage } from '../../core/storage';
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
};
