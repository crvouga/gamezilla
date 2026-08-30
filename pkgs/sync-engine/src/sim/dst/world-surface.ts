import type { SimClientHandle } from '../client-handle';
import type { InvariantViolation } from '../invariants';
import type { SimNetHandle } from '../net-effect';
import type { SimNetwork } from '../network';
import type { SimNodeHandle } from '../node-handle';
import type { SimServer } from '../server';
import type { LocalStorageTamper } from '../storage-faults';
import type { SimTraffic } from '../traffic';

/**
 * DST play/dispatch surface — structural subset of {@link World}.
 * Kept separate so `sim/dst/*` does not import `world-api` (no cycles).
 */
export type DstWorldSurface = {
  readonly seed: bigint;
  readonly clientIds: readonly string[];
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly server: SimServer;
  readonly network: SimNetwork;
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNetHandle;
  readonly node: (id: string) => SimNodeHandle;
  readonly runFor: (ms: number) => Promise<void>;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  readonly assertConverged: () => Promise<void>;
  readonly clearBoundaryFaults: () => void;
  readonly tamperLocalStorage: (
    clientId: string,
    tamper: LocalStorageTamper
  ) => Promise<void>;
  readonly brokerCrash: () => void;
  readonly brokerRestart: () => Promise<void>;
};
