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
  /** Mutable system bag from {@link defineSystem} `system()`. */
  readonly system: S;
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

const KIND_REGISTRY = new Map<string, NodeKindDef>();

export function defineNodeKind<H = unknown, V = unknown, S = unknown>(
  def: NodeKindDef<H, V, S>
): NodeKindDef<H, V, S> {
  KIND_REGISTRY.set(def.id, def as NodeKindDef);
  return def;
}

export function requireNodeKind(id: string): NodeKindDef {
  const kind = KIND_REGISTRY.get(id);
  if (kind === undefined) {
    throw new Error(`defineNodeKind: unknown kind ${id}`);
  }
  return kind;
}

/** Test-only: clear registry between contract suites. */
export function clearNodeKindRegistry(): void {
  KIND_REGISTRY.clear();
}
