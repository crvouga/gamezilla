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
import type { SimPlayHost } from './play';
import type { SimScheduler } from './scheduler';
import type { SimTrace } from './trace';
import type { NeverOpts, UntilOpts, UntilTarget } from './until';

export type WorldNodes = {
  readonly byRole: Readonly<Record<string, readonly NodeInstance[]>>;
  readonly byId: ReadonlyMap<string, NodeInstance>;
};

export type World<S = unknown> = SimPlayHost & {
  readonly deps: SimDeps;
  readonly clock: SimClock;
  readonly scheduler: SimScheduler;
  readonly network: SimNetwork;
  readonly nodes: WorldNodes;
  readonly system: S;
  readonly knobs: KnobCatalog<Record<string, JsonValue>>;
  readonly faults: FaultCatalog;
  readonly networkDefaults: SimNetFaultProfile;
  readonly startMs: number;
  node(role: string, id?: string): NodeInstance;
  roleIds(role: string): readonly string[];
  partition(a: SimNodeId, b: SimNodeId): void;
  heal(a: SimNodeId, b: SimNodeId): void;
  healAll(): void;
  hold(key: SimNetKey): void;
  release(key: SimNetKey): void;
  releaseAll(): void;
  runUntilIdle(stepMs?: number): Promise<void>;
  until(target: UntilTarget, opts?: UntilOpts): Promise<number>;
  never(target: UntilTarget, opts: NeverOpts): Promise<void>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

export type OpenWorldOpts = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly startMs?: number;
  readonly networkDefaults?: SimNetFaultProfile;
  readonly trace?: boolean | SimTrace;
};
