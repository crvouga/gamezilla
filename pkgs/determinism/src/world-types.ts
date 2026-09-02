import type { SimDeps } from './create-sim-deps';
import type { JsonValue } from './json';
import type { KnobDef, KnobValues } from './knobs';
import type {
  SimNetFaultProfile,
  SimNetKey,
  SimNetwork,
  SimNodeId,
} from './network';
import type { CountedNodeSpec, NodeKindDef, NodeSpecEntry } from './node';

type BootReturn<S extends NodeSpecEntry> =
  S extends NodeKindDef<infer H>
    ? H
    : S extends CountedNodeSpec<infer H>
      ? ReadonlyMap<string, H>
      : unknown;

export type NodeHandles<N extends Record<string, NodeSpecEntry>> = {
  [P in keyof N]: BootReturn<N[P]>;
};

export type UntilOpts = { readonly withinMs?: number };
export type NeverOpts = { readonly forMs: number };

export type WorldControls = {
  readonly seed: bigint;
  readonly startMs: number;
  readonly deps: SimDeps;
  readonly network: SimNetwork;
  readonly networkDefaults: SimNetFaultProfile;
  ids(role: string): readonly string[];
  now(): number;
  advance(ms: number): Promise<void>;
  idle(): Promise<void>;
  until(
    pred: () => boolean | Promise<boolean>,
    opts?: UntilOpts
  ): Promise<number>;
  never(pred: () => boolean | Promise<boolean>, opts: NeverOpts): Promise<void>;
  run<T>(promise: Promise<T>): Promise<T>;
  partition(a: SimNodeId, b: SimNodeId): Disposable;
  heal(a: SimNodeId, b: SimNodeId): void;
  healAll(): void;
  hold(key: SimNetKey): Disposable;
  release(key: SimNetKey): void;
  releaseAll(): void;
  play(actions: readonly JsonValue[]): Promise<void>;
  settle(): Promise<void>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

export type World<
  K extends Record<string, KnobDef> = Record<string, KnobDef>,
  N extends Record<string, NodeSpecEntry> = Record<string, NodeSpecEntry>,
  X = Record<string, never>,
> = WorldControls & {
  readonly knobs: KnobValues<K>;
  readonly nodes: NodeHandles<N>;
} & X;

export type OpenWorldOpts<
  K extends Record<string, KnobDef> = Record<string, KnobDef>,
> = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<KnobValues<K>>;
  readonly startMs?: number;
  readonly networkDefaults?: SimNetFaultProfile;
  readonly trace?: boolean | import('./trace').SimTrace;
};
