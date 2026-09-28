import type { Clock, Timers } from '@pkgs/clock';
import type { CreateId, Random } from '@pkgs/uuid';
import type {
  Deliver,
  EndpointId,
  Network,
  NetworkFaults,
  Rng,
  Scheduler,
  TraceRecorder,
} from '../internals';

export type Capability = 'virtualTime' | 'partition' | 'trace';

export class CapabilityError extends Error {
  readonly capability: Capability;
  constructor(capability: Capability, message?: string) {
    super(message ?? `CapabilityError: runtime lacks '${capability}'`);
    this.name = 'CapabilityError';
    this.capability = capability;
  }
}

/** Per-node send/listen bound to a fork address. */
export type Endpoint = {
  readonly id: EndpointId;
  readonly send: (to: EndpointId, payload: unknown) => void;
  readonly listen: (deliver: Deliver) => void;
  readonly unlisten: () => void;
};

export type Ports = {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly rng: Rng;
  readonly createId: CreateId;
  readonly random: Random;
  readonly network: Endpoint;
};

export type Session<P extends Ports = Ports> = {
  readonly ports: P;
  readonly scheduler: Scheduler;
  readonly network: Network;
  readonly trace?: TraceRecorder;
  readonly caps: ReadonlySet<Capability>;
  readonly fork: (name: string) => Session<P>;
  readonly dispose: () => Promise<void>;
  /** Drain ready scheduler events without advancing time. */
  readonly waitForIdle: () => Promise<void>;
  /** Runtime-defined time step (virtual: advance; wall: wait / driver runFor). */
  readonly advanceTime: (ms: number) => Promise<void>;
  /** Register dispose hook (runs before session teardown). */
  readonly onDispose: (fn: () => void | Promise<void>) => void;
};

export type Runtime<P extends Ports = Ports> = {
  readonly caps: ReadonlySet<Capability>;
  readonly open: (seed: number | bigint | string) => Promise<Session<P>>;
  readonly with: <Q extends Record<string, unknown>>(
    extra: (s: Session<P>) => Q | Promise<Q>
  ) => Runtime<P & Q>;
};

export type NetworkMode = 'model' | 'none';

export type VirtualTimeRuntimeOptions = {
  readonly network?: NetworkFaults;
  readonly startTime?: number;
  /** Override waitForIdle (e.g. sync heartbeats). */
  readonly waitForIdle?: (session: Session) => Promise<void>;
  /** Override advanceTime (e.g. a serialized runFor). */
  readonly advanceTime?: (session: Session, ms: number) => Promise<void>;
};

export type RealTimeRuntimeOptions = {
  readonly network: NetworkMode;
  readonly settleMs?: number;
  readonly networkFaults?: NetworkFaults;
  readonly waitForIdle?: (session: Session) => Promise<void>;
};
