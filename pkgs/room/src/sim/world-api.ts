import type { Clock } from '@pkgs/clock';
import type { Scheduler, WorldPorts } from '@pkgs/dst';
import type { SeededRng } from '@pkgs/uuid';
import type { InMemoryRoomStorage } from '../server/adapters/memory';
import type { RoomServer } from '../server/core/room-server';
import type {
  RoomCommand,
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import type { RoomCrashEvent } from './boundary-faults';
import type { RoomSimClientHandle, RoomSimNodeHandle } from './handles';
import type { RoomInvariantViolation } from './invariants';
import type {
  RoomNetEffect,
  RoomNetSetArg,
  SimRoomNetHandle,
  SimRoomNetwork,
} from './network';
import type {
  EventuallyOptions,
  NeverOptions,
  UntilPredicate,
} from './wait-until';

export type { RoomSimClientHandle, RoomSimNodeHandle } from './handles';

export type RoomSimAuthorize = (
  identity: string,
  topic: string,
  command: RoomCommand
) => Promise<{ ok: true } | { ok: false; reason: string }>;

/** Framework-owned deps + network for framework worlds (`@pkgs/dst` node kinds). */
export type InjectedRoomSimPorts = {
  readonly deps: WorldPorts;
  readonly network: SimRoomNetwork;
};

export type World<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly seed: bigint;
  readonly topic: string;
  readonly module: RoomModule<S, C, E, string>;
  readonly rng: SeededRng;
  readonly clock: Clock;
  /** @internal Lab / harness — scenarios use runFor / until */
  readonly scheduler: Scheduler;
  readonly storage: InMemoryRoomStorage;
  readonly server: RoomServer<S, C, E, string>;
  readonly clients: ReadonlyMap<string, RoomSimClientHandle<S, C, E>>;
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }) => Promise<RoomSimClientHandle<S, C, E>>;
  readonly net: (clientId: string) => SimRoomNetHandle;
  readonly node: (clientId: string) => RoomSimNodeHandle;
  readonly runFor: (ms: number) => Promise<void>;
  readonly until: (
    pred: UntilPredicate,
    opts?: EventuallyOptions
  ) => Promise<number>;
  readonly never: (pred: UntilPredicate, opts: NeverOptions) => Promise<void>;
  /** Domain state folded from the committed storage log (authority). */
  readonly serverSnapshot: () => Promise<S>;
  /** `module.hash` of {@link serverSnapshot}. */
  readonly serverHash: () => Promise<string>;
  readonly assertConverged: () => Promise<void>;
  readonly drain: () => Promise<void>;
  readonly checkInvariants: () => Promise<RoomInvariantViolation | null>;
  readonly armCrashAt: (clientId: string, event: RoomCrashEvent) => void;
  readonly clearBoundaryFaults: () => void;
  readonly serverCrash: () => Promise<void>;
  readonly serverRestart: () => Promise<void>;
  readonly isServerCrashed: () => boolean;
  readonly dispose: () => Promise<void>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

export type OpenWorldArgs<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly seed: number | bigint | string;
  readonly module: RoomModule<S, C, E, string>;
  readonly topic?: string;
  readonly startTime?: number;
  /** When true, boot with {@link MILD_ROOM_FAULTS}. */
  readonly mildFaults?: boolean;
  /** Optional per-command authorize hook (RoomServer). */
  readonly authorize?: RoomSimAuthorize;
  /** Share storage across worlds for multi-topic isolation tests. */
  readonly storage?: InMemoryRoomStorage;
  /**
   * Required — framework-owned deps + network from `@pkgs/dst`
   * (`ctx.ports` / `wrapRoomNetwork({ kernel: ctx.network })`).
   */
  readonly injected: InjectedRoomSimPorts;
};

export type { RoomCrashEvent } from './boundary-faults';
export type { RoomInvariantViolation } from './invariants';
// Re-export net types used by scenarios.
export type { RoomNetEffect, RoomNetSetArg };
