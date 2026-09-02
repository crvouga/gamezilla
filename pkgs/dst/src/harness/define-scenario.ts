import type { ActionCatalog } from './actions';
import type { KnobDef } from './knobs';
import type { NodeEntry } from './node';
import type { PropertyCatalog } from './property';
import type { World } from './world-types';

/**
 * A named, reproducible configuration: topology, Workload (`actions`),
 * Properties, fault weights, and Scenario parameters (`knobs`).
 */
export type ScenarioDef<
  K extends Record<string, KnobDef> = Record<string, KnobDef>,
  N extends Record<string, NodeEntry> = Record<string, NodeEntry>,
  S = unknown,
  X extends S = S,
  A extends ActionCatalog<S> = ActionCatalog<S>,
  P extends PropertyCatalog<S> = PropertyCatalog<S>,
> = {
  readonly id: string;
  readonly startTime?: number;
  readonly knobs: K;
  readonly nodes: N;
  readonly network?: {
    readonly faults?: import('../models/network').NetworkFaults;
    readonly edges?: readonly {
      readonly fromRole: string;
      readonly toRole: string;
    }[];
  };
  readonly actions: A;
  readonly properties: P;
  readonly extend?: (world: World<K, N, X>) => S | Promise<S>;
  readonly converge: (world: World<K, N, X>) => Promise<void>;
};

export type AnyScenarioDef = ScenarioDef<
  Record<string, KnobDef>,
  Record<string, NodeEntry>,
  unknown,
  unknown,
  ActionCatalog<unknown>,
  PropertyCatalog<unknown>
>;

export function defineScenario<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeEntry>,
  S,
  X extends S,
  A extends ActionCatalog<S>,
  P extends PropertyCatalog<S>,
>(def: ScenarioDef<K, N, S, X, A, P>): ScenarioDef<K, N, S, X, A, P> {
  if (Object.keys(def.nodes).length === 0) {
    throw new Error(`defineScenario(${def.id}): nodes must be non-empty`);
  }
  if (Object.keys(def.actions).length === 0) {
    throw new Error(`defineScenario(${def.id}): actions must be non-empty`);
  }
  return def;
}
