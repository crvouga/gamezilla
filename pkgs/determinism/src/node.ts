import type { SimDeps } from './create-sim-deps';
import type { JsonValue } from './json';
import type { KnobDef } from './knobs';
import type { SimDeliver, SimEndpointId, SimNetwork } from './network';

export type PeersView = {
  readonly single: (role: string) => unknown;
  readonly get: (role: string, id: string) => unknown;
  readonly ids: (role: string) => readonly string[];
};

export type NodeBootContext = {
  readonly id: string;
  readonly role: string;
  readonly index: number;
  readonly deps: SimDeps;
  readonly network: SimNetwork;
  readonly knob: <T extends JsonValue>(def: KnobDef<T>) => T;
  readonly peers: PeersView;
  readonly listen: (deliver: SimDeliver, endpointId?: SimEndpointId) => void;
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous node handles
export type NodeKindDef<H = any> = {
  readonly boot: (ctx: NodeBootContext) => H | Promise<H>;
  readonly dispose?: (handle: H) => void | Promise<void>;
};

export function node<H>(def: NodeKindDef<H>): NodeKindDef<H> {
  return def;
}

export type CountedNodeSpec<H = unknown> = NodeKindDef<H> & {
  readonly count: (knobs: Record<string, JsonValue>) => number;
  readonly id?: (index: number) => string;
};

export type NodeSpecEntry = NodeKindDef | CountedNodeSpec;

export function isCountedNode(spec: NodeSpecEntry): spec is CountedNodeSpec {
  return 'count' in spec && typeof spec.count === 'function';
}

export function resolveNodeCount(
  spec: NodeSpecEntry,
  knobValues: Record<string, JsonValue>
): number {
  if (isCountedNode(spec)) {
    const n = spec.count(knobValues);
    if (!(n >= 0) || !Number.isInteger(n)) {
      throw new Error(`resolveNodeCount: bad count ${n}`);
    }
    return n;
  }
  return 1;
}

export function defaultNodeId(
  role: string,
  index: number,
  count: number,
  idFor?: (index: number) => string
): string {
  if (idFor !== undefined) return idFor(index);
  if (count === 1) return role;
  return `${role}${index}`;
}
