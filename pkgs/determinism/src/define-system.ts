import type { ActionDef } from './action';
import type { FaultDef } from './faults';
import type { KnobDef } from './knobs';
import type { SimNetFaultProfile } from './network';
import type { NodeKindDef } from './node-kind';
import type { InvariantViolation } from './play';
import type { World } from './world-types';

export type { SystemAction } from './action';

/** Replica count: literal or derived from a numeric knob. */
export type NodeCount = number | { readonly fromKnob: string };

export type NodeSpec<S = unknown> = {
  /**
   * Value from {@link defineNodeKind}. Handle/view params use `any` so concrete
   * kinds remain assignable (dispose is contravariant in the handle type).
   */
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous node handles
  readonly kind: NodeKindDef<any, any, S>;
  readonly role: string;
  /** Default 1. Use `{ fromKnob }` to bind replica count to a knob. */
  readonly count?: NodeCount;
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

export type SystemDef<S = unknown, M = object, F = unknown> = {
  readonly id: string;
  readonly knobs: readonly KnobDef[];
  readonly nodes: readonly NodeSpec<S>[];
  /** Initial mutable package board shared across node boots + dispatch. */
  readonly state?: () => S;
  readonly network?: {
    readonly defaults?: SimNetFaultProfile;
    /**
     * Declared role→role edges. When present, `network.send` between
     * endpoints whose roles are not an allowed pair throws.
     */
    readonly edges?: readonly NetworkEdgeSpec[];
  };
  readonly faults?: readonly FaultDef[];
  /**
   * Chaos + domain ops. May be empty when the system is openWorld-only.
   * Prefer a homogeneous `as const` list so `ActionPayloadUnion` types the bag.
   */
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous action payloads
  readonly actions: readonly ActionDef<S, any, any, any>[];
  /** Required by assertSample; optional for scripted openWorld / replay. */
  readonly model?: SystemModelDef<M>;
  /**
   * Optional typed handle built after topology boot (replaces `prepare`).
   * Exposed as `world.facade`. Hydration / warmup belongs here.
   */
  readonly facade?: (world: World<S, F>) => F | Promise<F>;
  readonly settle: (world: World<S, F>) => Promise<void>;
  readonly invariants: (
    world: World<S, F>
  ) => Promise<InvariantViolation | null>;
  readonly startMs?: number;
};

export function defineSystem<S = unknown, M = object, F = unknown>(
  def: SystemDef<S, M, F>
): SystemDef<S, M, F> {
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

/** Resolve a NodeSpec.count to a non-negative integer. */
export function resolveNodeCount(
  count: NodeCount | undefined,
  getKnob: (id: string) => unknown
): number {
  if (count === undefined) return 1;
  if (typeof count === 'number') {
    if (!Number.isFinite(count) || count < 0) {
      throw new Error(`resolveNodeCount: bad count ${count}`);
    }
    return Math.floor(count);
  }
  const v = getKnob(count.fromKnob);
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new Error(
      `resolveNodeCount: knob ${count.fromKnob} must be non-negative number`
    );
  }
  return Math.floor(v);
}
