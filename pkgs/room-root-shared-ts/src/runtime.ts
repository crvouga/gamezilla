import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type {
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomState,
} from './types';

/**
 * Optional authoritative execution for any room module. Implement only the
 * hooks the game needs; installing a runtime does not require a simulation,
 * timers, or a second connection lifecycle.
 */
export type RoomRuntime<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  Identity = unknown,
> = {
  /** Validate a recovery value and turn it into an ordinary trusted command. */
  recover?(state: S, payload: RoomCommandPayload): C | null;
  /** On the room serial chain, include live progress in a durable command's decision. */
  project?(state: S): S;
  receive?(
    command: RoomCommand,
    identity: Identity,
    actor: RoomActor
  ): Promise<RoomError | null> | RoomError | null;
  update?(state: S): void;
  presence?(actors: readonly RoomActor[]): void;
  dispose?(): void;
};

export type RoomRuntimePorts<
  C extends RoomCommandPayload = RoomCommandPayload,
> = {
  /** Persist one bounded recovery value before it becomes visible to clients. */
  readonly checkpoint: (payload: RoomCommandPayload) => Promise<boolean>;
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
