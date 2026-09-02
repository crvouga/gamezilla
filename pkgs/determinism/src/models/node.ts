import type { JsonValue } from '../kernel/json';
import type { Deliver, EndpointId, Network } from './network';

/** Read a knob value by its definition; provided by the harness at start. */
export type KnobReader = <T extends JsonValue>(def: {
  readonly default: T;
}) => T;

export type Peers = {
  readonly single: (role: string) => unknown;
  readonly get: (role: string, id: string) => unknown;
  readonly nodeIds: (role: string) => readonly string[];
};

/**
 * What a Node receives when it starts. `ports` is the SUT-boundary bundle
 * (clock / timers / createId / random / http) plus the Scheduler and Trace.
 */
export type NodeContext<Ports = unknown> = {
  readonly id: string;
  readonly role: string;
  readonly index: number;
  readonly ports: Ports;
  readonly network: Network;
  readonly knob: KnobReader;
  readonly peers: Peers;
  readonly listen: (deliver: Deliver, endpointId?: EndpointId) => void;
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous node handles
export type NodeDef<H = any, Ports = any> = {
  readonly start: (ctx: NodeContext<Ports>) => H | Promise<H>;
  readonly stop?: (handle: H) => void | Promise<void>;
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous node handles
export type CountedNodeDef<H = unknown, Ports = any> = NodeDef<H, Ports> & {
  readonly count: (knobs: Record<string, JsonValue>) => number;
  readonly id?: (index: number) => string;
};

export type NodeEntry = NodeDef | CountedNodeDef;

export function isCountedNode(def: NodeEntry): def is CountedNodeDef {
  return 'count' in def && typeof def.count === 'function';
}

export function resolveNodeCount(
  def: NodeEntry,
  knobValues: Record<string, JsonValue>
): number {
  if (isCountedNode(def)) {
    const n = def.count(knobValues);
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

/** Node ids a role would boot with, derived from knob values alone. */
export function nodeIdsForRole(
  nodes: Record<string, NodeEntry>,
  knobs: Record<string, JsonValue>,
  role: string
): readonly string[] {
  const def = nodes[role];
  if (def === undefined) return [];
  const count = resolveNodeCount(def, knobs);
  const idFor = isCountedNode(def) ? def.id : undefined;
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(defaultNodeId(role, i, count, idFor));
  }
  return ids;
}

/** Memoized `role → ids` reader over a fixed node map + knob values. */
export function nodeIdsReader(
  nodes: Record<string, NodeEntry>,
  knobs: Record<string, JsonValue>
): (role: string) => readonly string[] {
  const cache = new Map<string, readonly string[]>();
  return (role) => {
    const hit = cache.get(role);
    if (hit !== undefined) return hit;
    const ids = nodeIdsForRole(nodes, knobs, role);
    cache.set(role, ids);
    return ids;
  };
}
