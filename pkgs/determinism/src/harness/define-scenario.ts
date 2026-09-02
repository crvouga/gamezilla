import type { NetworkFaults } from '../models/network';
import type { UnboundCommandDef } from './command';
import type { KnobDef } from './knobs';
import type { NodeEntry } from './node';
import type { World } from './world-types';

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous command payloads per scenario
type AnyCommandMap = Record<string, UnboundCommandDef<any, any, any>>;

/** Sequential reference model Commands are checked against (MBT). */
export type ReferenceModelDef<M = object> = {
  readonly initial: () => M;
};

/**
 * A named, reproducible configuration: topology (`nodes`), Workload
 * (`commands`), fault weights (`network.faults`), Properties (`always`,
 * `converge`), and Scenario parameters (`knobs`).
 *
 * TODO(dst-audit): `always` / `converge` are whole-World callbacks today; the
 * `always(p)` / `eventually(p, bound)` / `until(p, q)` taxonomy lands in Phase 4.
 */
export type ScenarioDef<
  K extends Record<string, KnobDef> = Record<string, KnobDef>,
  N extends Record<string, NodeEntry> = Record<string, NodeEntry>,
  M = object,
  X = Record<string, never>,
  A extends AnyCommandMap = AnyCommandMap,
> = {
  readonly id: string;
  readonly startTime?: number;
  readonly knobs: K;
  readonly nodes: N;
  readonly network?: {
    readonly faults?: NetworkFaults;
    readonly edges?: readonly {
      readonly fromRole: string;
      readonly toRole: string;
    }[];
  };
  readonly commands: A;
  readonly referenceModel?: ReferenceModelDef<M>;
  readonly extend?: (world: World<K, N, X>) => X | Promise<X>;
  /** Drive the World to its scenario-defined convergence point. */
  readonly converge: (world: World<K, N, X>) => Promise<void>;
  /** Safety Properties checked after every Command step and after `converge`. */
  readonly always: (world: World<K, N, X>) => Promise<void>;
};

export type AnyScenarioDef = ScenarioDef<
  Record<string, KnobDef>,
  Record<string, NodeEntry>,
  object,
  Record<string, unknown>,
  AnyCommandMap
>;

export function defineScenario<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeEntry>,
  M = object,
  X = Record<string, never>,
  A extends AnyCommandMap = AnyCommandMap,
>(def: ScenarioDef<K, N, M, X, A>): ScenarioDef<K, N, M, X, A> {
  if (Object.keys(def.nodes).length === 0) {
    throw new Error(`defineScenario(${def.id}): nodes must be non-empty`);
  }
  return def;
}
