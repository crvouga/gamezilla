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

export type WaitUntilOptions = { readonly withinMs?: number };
export type NeverOptions = { readonly forMs: number };

export type NetworkEdge = {
  readonly fromRole: string;
  readonly toRole: string;
};

export type WorldControls = {
  readonly seed: bigint;
  readonly startTime: number;
  readonly ports: WorldPorts;
  readonly network: Network;
  readonly networkFaults: NetworkFaults;
  readonly edges: readonly NetworkEdge[];
  nodeIds(role: string): readonly string[];
  now(): number;
  advance(ms: number): Promise<void>;
  quiesce(): Promise<void>;
  waitUntil(
    pred: () => boolean | Promise<boolean>,
    opts?: WaitUntilOptions
  ): Promise<number>;
  never(
    pred: () => boolean | Promise<boolean>,
    opts: NeverOptions
  ): Promise<void>;
  resolve<T>(promise: Promise<T>): Promise<T>;
  partition(a: NodeId, b: NodeId): Disposable;
  heal(a: NodeId, b: NodeId): void;
  healAll(): void;
  hold(key: FlowKey): Disposable;
  release(key: FlowKey): void;
  releaseAll(): void;
  apply(actions: readonly JsonValue[]): Promise<void>;
  converge(): Promise<void>;
  propertyCoverage(): ReadonlyMap<string, number>;
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
