import type { NeverOpts } from '@pkgs/determinism';

import type { SimClientHandle } from '../client-handle';
import type { SimNetHandle } from '../net-effect';
import type { SimNetwork } from '../network';
import type { SimNodeHandle } from '../node-handle';
import type { SeededRng } from '../rng';
import type { SimServer } from '../server';
import type { LocalStorageTamper } from '../storage-faults';
import type { StoragePressureKind } from '../storage-pressure';
import type { SimTraffic } from '../traffic';
import type { UntilTarget } from '../wait-until';
import type { AddClientArgs } from '../world-types';

/**
 * Scripted-pin / dispatch surface — sync extension merged onto framework World.
 */
export type SystemWorldSurface = {
  readonly seed: bigint;
  readonly rng: SeededRng;
  readonly clients: ReadonlyMap<string, SimClientHandle>;
  readonly server: SimServer;
  readonly kit: { readonly network: SimNetwork };
  readonly net: (nodeId: string, traffic?: SimTraffic) => SimNetHandle;
  readonly node: (id: string) => SimNodeHandle;
  readonly advance: (ms: number) => Promise<void>;
  readonly waitUntil: (
    target: UntilTarget,
    opts?: {
      readonly withinMs?: number;
      readonly budgetMs?: number;
      readonly stepMs?: number;
    }
  ) => Promise<number>;
  readonly waitNever: (target: UntilTarget, opts: NeverOpts) => Promise<void>;
  readonly pendingEventCount: () => number;
  readonly isSchedulerQuiescent: () => boolean;
  readonly checkInvariants: () => Promise<void>;
  readonly assertConverged: () => Promise<void>;
  readonly clearBoundaryFaults: () => void;
  readonly tamperLocalStorage: (
    clientId: string,
    tamper: LocalStorageTamper
  ) => Promise<void>;
  readonly armStoragePressure: (
    clientId: string,
    kind: StoragePressureKind,
    afterStatements?: number
  ) => void;
  readonly clearStoragePressure: (clientId?: string) => void;
  readonly armFailNextOpen: (clientId: string) => void;
  readonly clearFailNextOpen: (clientId?: string) => void;
  readonly addClient: (args: AddClientArgs) => Promise<SimClientHandle>;
  readonly brokerCrash: () => void;
  readonly brokerRestart: () => Promise<void>;
};
