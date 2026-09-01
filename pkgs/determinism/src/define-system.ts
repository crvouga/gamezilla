import type { ActionDef } from './action';
import type { FaultDef } from './faults';
import type { KnobDef } from './knobs';
import type { SimNetFaultProfile } from './network';
import type { NodeKindDef } from './node-kind';
import type { InvariantViolation } from './play';
import type { World } from './world-types';

export type { SystemAction } from './action';

export type NodeSpec<S = unknown> = {
  /**
   * Value from {@link defineNodeKind}. Handle/view params use `any` so concrete
   * kinds remain assignable (dispose is contravariant in the handle type).
   */
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous node handles
  readonly kind: NodeKindDef<any, any, S>;
  readonly role: string;
  readonly count?: number;
  /** Knob id whose numeric value is the replica count. */
  readonly countFromKnob?: string;
  /** Default: `${role}` when count===1 else `${role}${i}`. */
  readonly idFor?: (index: number) => string;
};

export type NetworkEdgeSpec = {
  readonly fromRole: string;
  readonly toRole: string;
};

export type SystemModelDef<M = object> = {
  readonly initial: () => M;
};

export type SystemDef<S = unknown, M = object> = {
  readonly id: string;
  readonly knobs: readonly KnobDef[];
  readonly nodes: readonly NodeSpec<S>[];
  /** Initial mutable package board shared across node boots + dispatch. */
  readonly state?: () => S;
  readonly network?: {
    readonly defaults?: SimNetFaultProfile;
    /** Declared role pairs for docs / std chaos helpers (optional). */
    readonly edges?: readonly NetworkEdgeSpec[];
  };
  readonly faults?: readonly FaultDef[];
  /**
   * Chaos + domain ops. May be empty when the system is openWorld-only.
   * Action payloads / models are heterogeneous per kind; `any` keeps
   * defineAction concrete types assignable into the system bag and across M.
   */
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous action payloads
  readonly actions: readonly ActionDef<S, any, any>[];
  /** Required by assertSample; optional for scripted openWorld / replay. */
  readonly model?: SystemModelDef<M>;
  /** After topology boot, before play (replaces warmup nodes). */
  readonly prepare?: (world: World<S>) => Promise<void>;
  readonly settle: (world: World<S>) => Promise<void>;
  readonly invariants: (world: World<S>) => Promise<InvariantViolation | null>;
  readonly startMs?: number;
};

export function defineSystem<S = unknown, M = object>(
  def: SystemDef<S, M>
): SystemDef<S, M> {
  if (def.nodes.length === 0) {
    throw new Error(`defineSystem(${def.id}): nodes must be non-empty`);
  }
  const kinds = new Set<string>();
  for (const action of def.actions) {
    if (kinds.has(action.kind)) {
      throw new Error(
        `defineSystem(${def.id}): duplicate action kind ${action.kind}`
      );
    }
    kinds.add(action.kind);
  }
  return def;
}
