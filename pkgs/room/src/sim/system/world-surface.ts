import type { NeverOpts } from '@pkgs/determinism';

import type { RoomCommandPayload, RoomEvent, RoomState } from '../../types';
import type { RoomCrashEvent } from '../boundary-faults';
import type { RoomSimClientHandle, RoomSimNodeHandle } from '../handles';
import type { SimRoomNetHandle } from '../network';
import type { UntilPredicate } from '../wait-until';

/**
 * DST play/dispatch surface — room extension merged onto framework World.
 */
export type RoomSystemWorldSurface<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly seed: bigint;
  readonly clients: ReadonlyMap<string, RoomSimClientHandle<S, C, E>>;
  readonly net: (clientId: string) => SimRoomNetHandle;
  readonly node: (clientId: string) => RoomSimNodeHandle;
  readonly runFor: (ms: number) => Promise<void>;
  readonly waitUntil: (
    pred: UntilPredicate,
    opts?: { readonly withinMs?: number; readonly budgetMs?: number }
  ) => Promise<number>;
  readonly waitNever: (pred: UntilPredicate, opts: NeverOpts) => Promise<void>;
  readonly checkInvariants: () => Promise<void>;
  readonly assertConverged: () => Promise<void>;
  readonly clearBoundaryFaults: () => void;
  readonly armCrashAt: (clientId: string, event: RoomCrashEvent) => void;
  readonly serverCrash: () => Promise<void>;
  readonly serverRestart: () => Promise<void>;
  readonly isServerCrashed: () => boolean;
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }) => Promise<RoomSimClientHandle<S, C, E>>;
};
