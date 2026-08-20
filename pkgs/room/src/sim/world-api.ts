import type { SimClock } from '@pkgs/clock';
import type { SeededRng } from '@pkgs/uuid';
import type { RoomClient } from '../client/core/room-client';
import type { InMemoryRoomStorage } from '../server/adapters/memory';
import type { RoomServer } from '../server/core/room-server';
import type {
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomModule,
  RoomState,
} from '../types';

import type { RoomNetEffect, RoomNetSetArg, SimRoomNetHandle } from './network';
import type { NeverOpts, UntilOpts, UntilTarget } from './until';

export type RoomSimAuthorize = (
  identity: string,
  topic: string,
  command: RoomCommand
) => Promise<{ ok: true } | { ok: false; reason: string }>;

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
  readonly room: () => RoomClient<S, C, E, string> | null;
  readonly disconnect: () => Promise<void>;
  readonly connect: () => Promise<void>;
  /** Most recent RoomError from a rejected wire frame (or null). */
  readonly lastRejection: () => RoomError | null;
  /** Inject raw client→server frame (for adversarial / dedup scenarios). */
  readonly injectToServer: (
    raw: unknown,
    opts?: { readonly direct?: boolean }
  ) => void;
  /** Inject raw server→client frame (bypasses net mesh). */
  readonly injectFromServer: (raw: unknown) => void;
};

export type RoomSimNodeHandle = {
  readonly disconnect: () => Promise<void>;
  readonly reconnect: () => Promise<void>;
  /**
   * Replace the live socket for this client's `(identity, clientId)` without
   * destroying the room client (session take-over).
   */
  readonly takeOver: () => Promise<void>;
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
  readonly rng: SeededRng;
  readonly clock: SimClock;
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
  readonly until: (target: UntilTarget, opts?: UntilOpts) => Promise<number>;
  readonly never: (target: UntilTarget, opts: NeverOpts) => Promise<void>;
  /** Domain state folded from the committed storage log (authority). */
  readonly serverSnapshot: () => Promise<S>;
  /** `module.hash` of {@link serverSnapshot}. */
  readonly serverHash: () => Promise<string>;
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
  /** Optional per-command authorize hook (RoomServer). */
  readonly authorize?: RoomSimAuthorize;
  /** Share storage across worlds for multi-topic isolation tests. */
  readonly storage?: InMemoryRoomStorage;
};

// Re-export net types used by scenarios.
export type { RoomNetEffect, RoomNetSetArg };
