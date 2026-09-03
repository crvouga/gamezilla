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
} from '../kernel';

export type Capability = 'virtualTime' | 'partition' | 'trace';

export class CapabilityError extends Error {
  readonly capability: Capability;
  constructor(capability: Capability, message?: string) {
    super(message ?? `CapabilityError: host lacks '${capability}'`);
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
  readonly settle: () => Promise<void>;
};

export type Host<P extends Ports = Ports> = {
  readonly caps: ReadonlySet<Capability>;
  readonly open: (seed: number | bigint | string) => Promise<Session<P>>;
  readonly with: <Q extends Record<string, unknown>>(
    extra: (s: Session<P>) => Q | Promise<Q>
  ) => Host<P & Q>;
};

export type NetworkMode = 'model' | 'none';

export type VirtualHostOptions = {
  readonly network?: NetworkFaults;
  readonly startTime?: number;
};

export type WallHostOptions = {
  readonly network: NetworkMode;
  readonly settleMs?: number;
  readonly networkFaults?: NetworkFaults;
};
