import type { SimDeps } from './create-sim-deps';
import type { FaultCatalog } from './faults';
import type { JsonValue } from './json';
import type { KnobCatalog } from './knobs';
import type { SimDeliver, SimEndpointId, SimNetwork } from './network';
import type { SimScheduler } from './scheduler';

export type NodeEndpoint = {
  readonly id: SimEndpointId;
  readonly deliver: SimDeliver;
};

export type NodeBootContext<S = unknown> = {
  readonly nodeId: string;
  readonly role: string;
  readonly index: number;
  readonly deps: SimDeps;
  readonly scheduler: SimScheduler;
  readonly network: SimNetwork;
  readonly knobs: KnobCatalog<Record<string, JsonValue>>;
  readonly faults: FaultCatalog;
  /** Mutable package board from {@link defineSystem} `state()`. */
  readonly state: S;
  /** Already-booted nodes by role (declaration order). */
  readonly nodesByRole: Readonly<Record<string, readonly NodeInstance[]>>;
  readonly nodesById: ReadonlyMap<string, NodeInstance>;
};

export type NodeInstance<H = unknown, V = unknown> = {
  readonly id: string;
  readonly role: string;
  readonly kind: string;
  readonly handle: H;
  readonly view: V;
};

export type NodeKindDef<H = unknown, V = unknown, S = unknown> = {
  readonly id: string;
  readonly boot: (ctx: NodeBootContext<S>) => H | Promise<H>;
  readonly dispose?: (handle: H) => void | Promise<void>;
  readonly endpoints?: (handle: H) => readonly NodeEndpoint[];
  readonly view?: (handle: H) => V;
};

/** Value-identity node kind — pass the returned object into SystemDef.nodes. */
export function defineNodeKind<H = unknown, V = unknown, S = unknown>(
  def: NodeKindDef<H, V, S>
): NodeKindDef<H, V, S> {
  return def;
}
