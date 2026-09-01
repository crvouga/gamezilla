import type { Arbitrary } from 'fast-check';
import type { FaultDef } from './faults';
import type { JsonValue } from './json';
import type { KnobDef } from './knobs';
import type { LibraryDef } from './library';
import type { SimNetFaultProfile } from './network';
import type { DomainModelHooks, InvariantViolation } from './play';
import type { World } from './world-types';

export type SystemKnobDef<T extends JsonValue = JsonValue> = KnobDef<T> & {
  readonly arb: Arbitrary<T>;
};

export function defineSystemKnob<T extends JsonValue>(
  def: SystemKnobDef<T>
): SystemKnobDef<T> {
  return def;
}

export type NodeSpec = {
  readonly kind: string;
  readonly role: string;
  readonly count?: number;
  readonly countFromKnob?: string;
  /** Default: `${role}` when count===1 else `${role}${i}`; clients often `c${i}`. */
  readonly idFor?: (index: number) => string;
};

export type DomainDef<S = unknown> = {
  readonly arbs: (ctx: {
    readonly roleIds: (role: string) => readonly string[];
    readonly knobs: Readonly<Record<string, JsonValue>>;
  }) => readonly Arbitrary<JsonValue>[];
  readonly dispatch: (world: World<S>, op: JsonValue) => Promise<void>;
  readonly model?: DomainModelHooks<object, JsonValue>;
};

export type SystemAction = JsonValue & { readonly kind: string };

export type SystemDef<S = unknown> = {
  readonly id: string;
  readonly knobs: readonly SystemKnobDef[];
  readonly nodes: readonly NodeSpec[];
  /** Initial mutable system bag shared across node boots + dispatch. */
  readonly system?: () => S;
  readonly network?: { readonly defaults?: SimNetFaultProfile };
  readonly faults?: readonly FaultDef[];
  readonly library?: readonly LibraryDef<S>[];
  readonly domain?: DomainDef<S>;
  /** Unified model for all actions (library + domain). */
  readonly model?: DomainModelHooks<object, JsonValue>;
  readonly settle: (world: World<S>) => Promise<void>;
  readonly checkInvariants?: (
    world: World<S>
  ) => Promise<InvariantViolation | null>;
  readonly prepareConverge?: (world: World<S>) => Promise<void>;
  readonly startMs?: number;
};

export function defineSystem<S = unknown>(def: SystemDef<S>): SystemDef<S> {
  if (def.nodes.length === 0) {
    throw new Error(`defineSystem(${def.id}): nodes must be non-empty`);
  }
  return def;
}
