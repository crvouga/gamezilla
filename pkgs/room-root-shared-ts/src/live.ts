import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type {
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomState,
} from './types';

/** Optional execution hosted by this room; no second connection or transport lifecycle. */
export type RoomLiveSession<S extends RoomState, Identity> = {
  /** On the room serial chain, include live progress in a durable command's decision. */
  project?(state: S): S;
  receive(
    command: RoomCommand,
    identity: Identity,
    actor: RoomActor
  ): Promise<RoomError | null> | RoomError | null;
  update(state: S): void;
  presence(actors: readonly RoomActor[]): void;
  dispose(): void;
};

export type RoomLivePorts<C extends RoomCommandPayload> = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly publish: (
    payload: RoomCommandPayload,
    audience?: readonly string[]
  ) => void;
  /** Trusted host work re-enters ordinary room validation and durable commit. */
  readonly commit: (id: string, payload: C) => Promise<void>;
  /** Simulation wakes share the room's serial chain with commands and membership. */
  readonly enqueue: (work: () => void) => void;
  readonly onError: (error: unknown) => void;
};
