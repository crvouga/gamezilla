import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import type { Scheduler as VirtualScheduler } from '@pkgs/harness-root-shared-ts/scheduler';
import type { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import type { RoomServer } from '@pkgs/room-root-server-ts/room-server';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { SeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';

import type { RoomCrashEvent } from './edge-faults';
import type { RoomHarnessClient, RoomHarnessNode } from './handles';
import type { RoomInvariantViolation } from './invariants';
import type { HarnessRoomNetwork, RoomHarnessNet } from './network';
import type {
  NeverOptions,
  UntilPredicate,
  WaitUntilOptions,
} from './wait-until';

/** Kernel ports the kit needs, derived from a DST `Session`. */
export type RoomHarnessRuntimeDeps = {
  readonly seed: bigint;
  readonly clock: Clock;
  readonly scheduler: VirtualScheduler;
  readonly timers: Timers;
  readonly rng: SeededRng;
  readonly createId: CreateId;
};

export type InjectedRoomHarnessPorts = {
  readonly deps: RoomHarnessRuntimeDeps;
  readonly network: HarnessRoomNetwork;
};

export type RoomHarnessRuntime<
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
  readonly clients: ReadonlyMap<string, RoomHarnessClient<S, C, E>>;
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }) => Promise<RoomHarnessClient<S, C, E>>;
  readonly net: (clientId: string) => RoomHarnessNet;
  readonly node: (clientId: string) => RoomHarnessNode;
  readonly runFor: (ms: number) => Promise<void>;
  readonly until: (
    pred: UntilPredicate,
    opts?: WaitUntilOptions
  ) => Promise<number>;
  readonly never: (pred: UntilPredicate, opts: NeverOptions) => Promise<void>;
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

export type OpenRoomHarnessArgs<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly session: Session;
  readonly module: RoomModule<S, C, E, string>;
  readonly topic?: string;
  /** When true, boot with {@link MILD_ROOM_FAULTS}. */
  readonly mildFaults?: boolean;
  /** Share storage across systems for multi-topic isolation tests. */
  readonly storage?: InMemoryRoomStorage;
};
