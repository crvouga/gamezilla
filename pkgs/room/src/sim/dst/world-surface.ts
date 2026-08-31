import type { RoomCommandPayload, RoomEvent, RoomState } from '../../types';
import type { RoomCrashEvent } from '../boundary-faults';
import type { RoomSimClientHandle, RoomSimNodeHandle } from '../handles';
import type { RoomInvariantViolation } from '../invariants';
import type { SimRoomNetHandle } from '../network';

/**
 * DST play/dispatch surface — structural subset of World.
 * Kept separate so `sim/dst/*` does not import `world-api` (no cycles).
 */
export type RoomDstWorldSurface<
  S extends RoomState = RoomState,
  C extends RoomCommandPayload = RoomCommandPayload,
  E extends RoomEvent = RoomEvent,
> = {
  readonly seed: bigint;
  readonly clients: ReadonlyMap<string, RoomSimClientHandle<S, C, E>>;
  readonly net: (clientId: string) => SimRoomNetHandle;
  readonly node: (clientId: string) => RoomSimNodeHandle;
  readonly runFor: (ms: number) => Promise<void>;
  readonly checkInvariants: () => Promise<RoomInvariantViolation | null>;
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
