import type { JsonValue } from '../kernel/json';
import type { TraceRecorder } from '../kernel/trace';
import type {
  FlowKey,
  Network,
  NetworkFaults,
  NodeId,
} from '../models/network';
import type { KnobDef, KnobValues } from './knobs';
import type { CountedNodeDef, NodeDef, NodeEntry } from './node';
import type { WorldPorts } from './world-ports';

type StartReturn<S extends NodeEntry> =
  S extends NodeDef<infer H>
    ? H
    : S extends CountedNodeDef<infer H>
      ? ReadonlyMap<string, H>
      : unknown;

export type NodeHandles<N extends Record<string, NodeEntry>> = {
  [P in keyof N]: StartReturn<N[P]>;
};

/** Virtual-time bound for `eventually`. */
export type EventuallyOptions = { readonly withinMs?: number };
/** Virtual-time window for `never`. */
export type NeverOptions = { readonly forMs: number };

export type WorldControls = {
  readonly seed: bigint;
  readonly startTime: number;
  readonly ports: WorldPorts;
  readonly network: Network;
  readonly networkFaults: NetworkFaults;
  nodeIds(role: string): readonly string[];
  now(): number;
  advance(ms: number): Promise<void>;
  /** Run until Quiescence (no runnable Tasks, only timers remain). */
  quiesce(): Promise<void>;
  /** Bounded liveness: `p` holds within `withinMs` of virtual time. */
  eventually(
    pred: () => boolean | Promise<boolean>,
    opts?: EventuallyOptions
  ): Promise<number>;
  /**
   * `p` never holds for `forMs` of virtual time.
   * TODO(dst-audit): becomes `always(() => !p(), { forMs })` in Phase 4 (D11).
   */
  never(
    pred: () => boolean | Promise<boolean>,
    opts: NeverOptions
  ): Promise<void>;
  /** Drive the Scheduler until a host promise settles; rethrows its rejection. */
  resolve<T>(promise: Promise<T>): Promise<T>;
  partition(a: NodeId, b: NodeId): Disposable;
  heal(a: NodeId, b: NodeId): void;
  healAll(): void;
  hold(key: FlowKey): Disposable;
  release(key: FlowKey): void;
  releaseAll(): void;
  /** Apply serialized Commands in order, stepping and checking `always` after each. */
  apply(commands: readonly JsonValue[]): Promise<void>;
  /** Run the Scenario's `converge`, then its `always` Properties. */
  converge(): Promise<void>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

export type World<
  K extends Record<string, KnobDef> = Record<string, KnobDef>,
  N extends Record<string, NodeEntry> = Record<string, NodeEntry>,
  X = Record<string, never>,
> = WorldControls & {
  readonly knobs: KnobValues<K>;
  readonly nodes: NodeHandles<N>;
} & X;

export type OpenWorldOptions<
  K extends Record<string, KnobDef> = Record<string, KnobDef>,
> = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<KnobValues<K>>;
  readonly startTime?: number;
  readonly networkFaults?: NetworkFaults;
  readonly trace?: boolean | TraceRecorder;
};
