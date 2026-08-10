import type { SimClock, SimIo } from '@pkgs/io';
import type { Room } from '../client/core/room';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import type { RoomNetEffect, RoomNetSetArg, SimRoomNetHandle } from './network';
import type { NeverOpts, UntilOpts, UntilTarget } from './until';

export type RoomSimClientHandle<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly id: string;
  readonly identity: string;
  readonly clientId: string;
  readonly dispatch: (payload: C) => void;
  readonly snapshot: () => S;
  readonly hash: () => string;
  readonly isSynced: () => boolean;
  readonly isConnected: () => boolean;
  readonly room: () => Room<S, C, E, string> | null;
  readonly disconnect: () => Promise<void>;
  readonly connect: () => Promise<void>;
};

export type RoomSimNodeHandle = {
  readonly disconnect: () => Promise<void>;
  readonly reconnect: () => Promise<void>;
  readonly now: () => number;
};

export type RoomSimWorld<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly seed: bigint;
  readonly topic: string;
  readonly module: RoomModule<S, C, E, string>;
  readonly io: SimIo;
  readonly clock: SimClock;
  readonly clients: ReadonlyMap<string, RoomSimClientHandle<S, C, E>>;
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
  }) => Promise<RoomSimClientHandle<S, C, E>>;
  readonly net: (clientId: string) => SimRoomNetHandle;
  readonly node: (clientId: string) => RoomSimNodeHandle;
  readonly runFor: (ms: number) => Promise<void>;
  readonly until: (target: UntilTarget, opts?: UntilOpts) => Promise<number>;
  readonly never: (target: UntilTarget, opts: NeverOpts) => Promise<void>;
  readonly assertConverged: () => Promise<void>;
  readonly drain: () => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

export type OpenRoomSimWorldArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly seed: number | bigint | string;
  readonly module: RoomModule<S, C, E, string>;
  readonly topic?: string;
  readonly startMs?: number;
  /** When true, boot with {@link MILD_ROOM_FAULTS}. */
  readonly mildFaults?: boolean;
};

// Re-export net types used by scenarios.
export type { RoomNetEffect, RoomNetSetArg };
