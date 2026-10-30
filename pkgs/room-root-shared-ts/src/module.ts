import { hashRoomState } from './hash-room-state';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from './types';
import { assertRoomModuleName } from './types';

/** The same definition serves discrete turns, continuous play, or both. */
export type RoomDefinition<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
  Identity = unknown,
> = Omit<RoomModule<S, C, E, Identity>, 'name' | 'hash' | 'recoverEffects'> & {
  readonly name: string;
  readonly hash?: RoomModule<S, C, E, Identity>['hash'];
  /** Required for modules with recoverable effects, such as turn deadlines. */
  readonly recoverEffects?: RoomModule<S, C, E, Identity>['recoverEffects'];
};

/**
 * Define game rules once for prediction, authoritative decisions, and replay.
 * Hosts instantiate createRuntime only on the server; pure turn games need
 * only name, initialState, handle, and reduce. No timer or I/O is allocated here.
 */
export function defineRoomModule<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
  Identity = unknown,
>(
  definition: RoomDefinition<S, C, E, Identity>
): RoomModule<S, C, E, Identity> {
  return {
    ...definition,
    name: assertRoomModuleName(definition.name),
    hash: definition.hash ?? hashRoomState,
    recoverEffects: definition.recoverEffects ?? (() => []),
  };
}
