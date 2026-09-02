import type { UnboundActionDef } from './action';
import type { KnobDef } from './knobs';
import type { SimNetFaultProfile } from './network';
import type { NodeSpecEntry } from './node';
import type { World } from './world-types';

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous action payloads per system
type AnyActionMap = Record<string, UnboundActionDef<any, any, any>>;

export type SystemModelDef<M = object> = {
  readonly initial: () => M;
};

export type SystemDef<
  K extends Record<string, KnobDef> = Record<string, KnobDef>,
  N extends Record<string, NodeSpecEntry> = Record<string, NodeSpecEntry>,
  M = object,
  X = Record<string, never>,
  A extends AnyActionMap = AnyActionMap,
> = {
  readonly id: string;
  readonly startMs?: number;
  readonly knobs: K;
  readonly nodes: N;
  readonly network?: {
    readonly faults?: SimNetFaultProfile;
    readonly edges?: readonly {
      readonly fromRole: string;
      readonly toRole: string;
    }[];
  };
  readonly actions: A;
  readonly model?: SystemModelDef<M>;
  readonly extend?: (world: World<K, N, X>) => X | Promise<X>;
  readonly settle: (world: World<K, N, X>) => Promise<void>;
  readonly invariants: (world: World<K, N, X>) => Promise<void>;
};

export type AnySystemDef = SystemDef<
  Record<string, KnobDef>,
  Record<string, NodeSpecEntry>,
  object,
  Record<string, unknown>,
  AnyActionMap
>;

export function defineSystem<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeSpecEntry>,
  M = object,
  X = Record<string, never>,
  A extends AnyActionMap = AnyActionMap,
>(def: SystemDef<K, N, M, X, A>): SystemDef<K, N, M, X, A> {
  if (Object.keys(def.nodes).length === 0) {
    throw new Error(`defineSystem(${def.id}): nodes must be non-empty`);
  }
  return def;
}

export type { SystemAction } from './action';
