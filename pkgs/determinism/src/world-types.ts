import type { SimClock } from './clock';
import type { SimDeps } from './create-sim-deps';
import type { FaultCatalog } from './faults';
import type { JsonValue } from './json';
import type { KnobCatalog } from './knobs';
import type {
  SimNetFaultProfile,
  SimNetKey,
  SimNetwork,
  SimNodeId,
} from './network';
import type { NodeInstance } from './node-kind';
import type { NeverOpts, UntilOpts } from './until';

export type WorldNodes = {
  readonly byRole: Readonly<Record<string, readonly NodeInstance[]>>;
  readonly byId: ReadonlyMap<string, NodeInstance>;
};

export type World<S = unknown> = {
  readonly seed: bigint;
  readonly deps: SimDeps;
  readonly clock: SimClock;
  readonly network: SimNetwork;
  readonly nodes: WorldNodes;
  readonly state: S;
  readonly knobs: KnobCatalog<Record<string, JsonValue>>;
  readonly faults: FaultCatalog;
  readonly networkDefaults: SimNetFaultProfile;
  readonly startMs: number;
  node(role: string, id?: string): NodeInstance;
  roleIds(role: string): readonly string[];
  /** Partition all endpoint pairs between two nodes. */
  partition(a: SimNodeId, b: SimNodeId): void;
  heal(a: SimNodeId, b: SimNodeId): void;
  healAll(): void;
  hold(key: SimNetKey): void;
  release(key: SimNetKey): void;
  releaseAll(): void;
  /** Advance virtual time by `ms` (fires due tasks). */
  advance(ms: number): Promise<void>;
  /** Drain the scheduler toward idle (framework-owned budget). */
  idle(): Promise<void>;
  until(
    pred: () => boolean | Promise<boolean>,
    opts?: UntilOpts
  ): Promise<number>;
  never(pred: () => boolean | Promise<boolean>, opts: NeverOpts): Promise<void>;
  /** Run system.settle then system.invariants (throws on violation). */
  settle(): Promise<void>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

export type OpenWorldOpts = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly startMs?: number;
  readonly networkDefaults?: SimNetFaultProfile;
  readonly trace?: boolean | import('./trace').SimTrace;
};
