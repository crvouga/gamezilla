import type { Clock, Timers } from '@pkgs/clock';
import type {
  RoomCommand,
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room';
import type { RoomServer } from '@pkgs/room/server';
import type { InMemoryRoomStorage } from '@pkgs/room-adapter-memory';
import type { Session, VirtualScheduler } from '@pkgs/sim';
import type { CreateId, SeededRng } from '@pkgs/uuid';

import type { RoomCrashEvent } from './edge-faults';
import type { RoomInvariantViolation } from './invariants';
import type {
  RoomNetEffect,
  RoomNetSetArg,
  RoomSimNet,
  SimRoomNetwork,
} from './network';
import type { RoomSimClient, RoomSimNode } from './sim-handles';
import type {
  NeverOptions,
  UntilPredicate,
  WaitUntilOptions,
} from './wait-until';

export type { RoomSimClient, RoomSimNode } from './sim-handles';

export type RoomSimAuthorize = (
  identity: string,
  topic: string,
  command: RoomCommand
) => Promise<{ ok: true } | { ok: false; reason: string }>;

/** Kernel ports the kit needs, derived from a DST `Session`. */
export type RoomSimRuntimeDeps = {
  readonly seed: bigint;
  readonly clock: Clock;
  readonly scheduler: VirtualScheduler;
  readonly timers: Timers;
  readonly rng: SeededRng;
  readonly createId: CreateId;
};

export type InjectedRoomSimPorts = {
  readonly deps: RoomSimRuntimeDeps;
  readonly network: SimRoomNetwork;
};

export type RoomSimRuntime<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly seed: bigint;
  readonly topic: string;
  readonly module: RoomModule<S, C, E, string>;
  readonly rng: SeededRng;
  readonly clock: Clock;
  readonly scheduler: VirtualScheduler;
  readonly storage: InMemoryRoomStorage;
  readonly server: RoomServer<S, C, E, string>;
  readonly clients: ReadonlyMap<string, RoomSimClient<S, C, E>>;
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }) => Promise<RoomSimClient<S, C, E>>;
  readonly net: (clientId: string) => RoomSimNet;
  readonly node: (clientId: string) => RoomSimNode;
  readonly runFor: (ms: number) => Promise<void>;
  readonly until: (
    pred: UntilPredicate,
    opts?: WaitUntilOptions
  ) => Promise<number>;
  readonly never: (pred: UntilPredicate, opts: NeverOptions) => Promise<void>;
  /** Alias for {@link RoomSimRuntime.until}. */
  readonly waitUntil: (
    pred: UntilPredicate,
    opts?: WaitUntilOptions
  ) => Promise<number>;
  /** Alias for {@link RoomSimRuntime.never}. */
  readonly waitNever: (
    pred: UntilPredicate,
    opts: NeverOptions
  ) => Promise<void>;
  /** Domain state folded from the committed storage log (authority). */
  readonly serverSnapshot: () => Promise<S>;
  /** `module.hash` of {@link serverSnapshot}. */
  readonly serverHash: () => Promise<string>;
  readonly recoverAll: () => Promise<void>;
  readonly drain: () => Promise<void>;
  readonly checkInvariants: () => Promise<RoomInvariantViolation | null>;
  readonly armCrashAt: (clientId: string, event: RoomCrashEvent) => void;
  readonly clearEdgeFaults: () => void;
  readonly serverCrash: () => Promise<void>;
  readonly serverRestart: () => Promise<void>;
  readonly isServerCrashed: () => boolean;
  readonly dispose: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

export type OpenRoomSimArgs<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly session: Session;
  readonly module: RoomModule<S, C, E, string>;
  readonly topic?: string;
  /** When true, boot with {@link MILD_ROOM_FAULTS}. */
  readonly mildFaults?: boolean;
  /** Optional per-command authorize hook (RoomServer). */
  readonly authorize?: RoomSimAuthorize;
  /** Share storage across systems for multi-topic isolation tests. */
  readonly storage?: InMemoryRoomStorage;
};

export type { RoomCrashEvent } from './edge-faults';
export type { RoomInvariantViolation } from './invariants';
export type { RoomNetEffect, RoomNetSetArg };
