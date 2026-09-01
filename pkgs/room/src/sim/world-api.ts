import type { SimClock, SimDeps, SimScheduler } from '@pkgs/determinism';
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
import type { NeverOpts, UntilOpts, UntilPredicate } from './until';

export type { RoomSimClientHandle, RoomSimNodeHandle } from './handles';

export type RoomSimAuthorize = (
  identity: string,
  topic: string,
  command: RoomCommand
) => Promise<{ ok: true } | { ok: false; reason: string }>;

/** Framework-owned deps + network for framework worlds (`@pkgs/determinism` node kinds). */
export type InjectedRoomSimPorts = {
  readonly deps: SimDeps;
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
  readonly clock: SimClock;
  /** @internal Lab / harness — scenarios use runFor / until */
  readonly scheduler: SimScheduler;
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
  readonly until: (pred: UntilPredicate, opts?: UntilOpts) => Promise<number>;
  readonly never: (pred: UntilPredicate, opts: NeverOpts) => Promise<void>;
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
  readonly startMs?: number;
  /** When true, boot with {@link MILD_ROOM_FAULTS}. */
  readonly mildFaults?: boolean;
  /** Optional per-command authorize hook (RoomServer). */
  readonly authorize?: RoomSimAuthorize;
  /** Share storage across worlds for multi-topic isolation tests. */
  readonly storage?: InMemoryRoomStorage;
  /** framework only — framework-owned deps + network from `@pkgs/determinism` node kinds. */
  readonly injected?: InjectedRoomSimPorts;
};

export type { RoomCrashEvent } from './boundary-faults';
export type { RoomInvariantViolation } from './invariants';
// Re-export net types used by scenarios.
export type { RoomNetEffect, RoomNetSetArg };
