import { createSimDeps } from './create-sim-deps';
import { resolveNodeCount, type SystemDef } from './define-system';
import { createFaultCatalog } from './faults';
import { createKnobCatalog } from './knobs';
import {
  createSimNetwork,
  RELIABLE_NET_FAULTS,
  type SimNetFaultProfile,
  type SimNetwork,
  type SimNodeId,
} from './network';
import type { NodeInstance } from './node-kind';
import { throwIfInvariant } from './play';
import { never, until } from './until';
import type { OpenWorldOpts, World } from './world-types';

function defaultNodeId(role: string, index: number, count: number): string {
  if (count === 1) return role;
  return `${role}${index}`;
}

type BootedNode = NodeInstance & {
  readonly dispose?: () => void | Promise<void>;
  readonly endpointIds: readonly string[];
};

type BootArgs = {
  readonly deps: ReturnType<typeof createSimDeps>;
  readonly network: SimNetwork;
  readonly knobs: ReturnType<typeof createKnobCatalog>;
  readonly faults: ReturnType<typeof createFaultCatalog>;
  readonly stateBag: unknown;
  readonly endpointRoles: Map<string, string>;
};

async function bootTopology(
  system: SystemDef<unknown>,
  args: BootArgs
): Promise<{
  readonly byRole: Record<string, NodeInstance[]>;
  readonly byId: Map<string, NodeInstance>;
  readonly booted: BootedNode[];
}> {
  const byRole: Record<string, NodeInstance[]> = {};
  const byId = new Map<string, NodeInstance>();
  const booted: BootedNode[] = [];

  for (const spec of system.nodes) {
    const count = resolveNodeCount(spec.count, (id) => args.knobs.get(id));
    const kind = spec.kind;
    for (let index = 0; index < count; index += 1) {
      const nodeId =
        spec.idFor?.(index) ?? defaultNodeId(spec.role, index, count);
      if (byId.has(nodeId)) {
        throw new Error(`openWorld: duplicate node id ${nodeId}`);
      }
      const handle = await kind.boot({
        nodeId,
        role: spec.role,
        index,
        deps: args.deps,
        scheduler: args.deps.scheduler,
        network: args.network,
        knobs: args.knobs,
        faults: args.faults,
        state: args.stateBag,
        nodesByRole: byRole,
        nodesById: byId,
      });
      const endpoints = kind.endpoints?.(handle) ?? [];
      for (const ep of endpoints) {
        args.network.register(ep.id, ep.deliver);
        args.endpointRoles.set(ep.id, spec.role);
      }
      const view = kind.view?.(handle) ?? handle;
      const instance: NodeInstance = {
        id: nodeId,
        role: spec.role,
        kind: kind.id,
        handle,
        view,
      };
      const list = byRole[spec.role] ?? [];
      list.push(instance);
      byRole[spec.role] = list;
      byId.set(nodeId, instance);
      booted.push({
        ...instance,
        endpointIds: endpoints.map((e) => e.id),
        ...(kind.dispose !== undefined
          ? {
              dispose: () => kind.dispose!(handle),
            }
          : {}),
      });
    }
  }
  return { byRole, byId, booted };
}

function wrapNetworkWithEdges(
  network: SimNetwork,
  edges: readonly { readonly fromRole: string; readonly toRole: string }[],
  endpointRoles: Map<string, string>
): SimNetwork {
  if (edges.length === 0) return network;
  const allowed = new Set<string>();
  for (const e of edges) {
    allowed.add(`${e.fromRole}\0${e.toRole}`);
    allowed.add(`${e.toRole}\0${e.fromRole}`);
  }
  return {
    ...network,
    send(from, to, payload, opts) {
      if (from !== to) {
        const fr = endpointRoles.get(from);
        const tr = endpointRoles.get(to);
        if (
          fr !== undefined &&
          tr !== undefined &&
          !allowed.has(`${fr}\0${tr}`)
        ) {
          throw new Error(
            `SimNetwork.send: undeclared edge ${fr}→${tr} (from=${from} to=${to})`
          );
        }
      }
      network.send(from, to, payload, opts);
    },
  };
}

function pickNode(
  byRole: Record<string, readonly NodeInstance[]>,
  byId: ReadonlyMap<string, NodeInstance>,
  role: string,
  id?: string
): NodeInstance {
  if (id !== undefined) {
    const n = byId.get(id);
    if (n === undefined || n.role !== role) {
      throw new Error(`World.node: no ${role} with id ${id}`);
    }
    return n;
  }
  const list = byRole[role];
  if (list === undefined || list.length === 0) {
    throw new Error(`World.node: no nodes for role ${role}`);
  }
  if (list.length !== 1) {
    throw new Error(
      `World.node: role ${role} has ${list.length} nodes; pass id`
    );
  }
  return list[0]!;
}

function makeDispose(
  booted: readonly BootedNode[],
  network: SimNetwork
): () => Promise<void> {
  let disposed = false;
  return async () => {
    if (disposed) return;
    disposed = true;
    for (let i = booted.length - 1; i >= 0; i -= 1) {
      const n = booted[i]!;
      for (const ep of n.endpointIds) network.unregister(ep);
      if (n.dispose !== undefined) await n.dispose();
    }
  };
}

function endpointsForNode(
  booted: readonly BootedNode[],
  nodeId: SimNodeId
): readonly string[] {
  const n = booted.find((b) => b.id === nodeId);
  if (n === undefined) {
    throw new Error(`World: unknown node id ${nodeId}`);
  }
  return n.endpointIds;
}

function forEachEndpointPair(
  aEps: readonly string[],
  bEps: readonly string[],
  fn: (a: string, b: string) => void
): void {
  for (const a of aEps) {
    for (const b of bEps) {
      if (a === b) continue;
      fn(a, b);
    }
  }
}

function assembleWorld<S, F>(args: {
  readonly system: SystemDef<S, object, F>;
  readonly deps: ReturnType<typeof createSimDeps>;
  readonly network: SimNetwork;
  readonly knobs: ReturnType<typeof createKnobCatalog>;
  readonly faults: ReturnType<typeof createFaultCatalog>;
  readonly stateBag: S;
  readonly facade: F;
  readonly networkDefaults: SimNetFaultProfile;
  readonly startMs: number;
  readonly byRole: Record<string, NodeInstance[]>;
  readonly byId: Map<string, NodeInstance>;
  readonly booted: BootedNode[];
  readonly dispose: () => Promise<void>;
}): World<S, F> {
  const { deps, network, system, stateBag, byRole, byId, booted } = args;
  const untilCtx = {
    clock: deps.clock,
    scheduler: deps.scheduler,
    seed: deps.seed,
    heldSummary: () => network.heldSummary(),
  };
  let world!: World<S, F>;
  world = {
    seed: deps.seed,
    deps,
    clock: deps.clock,
    network,
    state: stateBag,
    get facade() {
      return args.facade;
    },
    knobs: args.knobs,
    faults: args.faults,
    networkDefaults: args.networkDefaults,
    startMs: args.startMs,
    nodes: { byRole, byId },
    node: (role, id) => pickNode(byRole, byId, role, id),
    roleIds: (role) => (byRole[role] ?? []).map((n) => n.id),
    partition: (a, b) => {
      forEachEndpointPair(
        endpointsForNode(booted, a),
        endpointsForNode(booted, b),
        (x, y) => network.partition(x, y)
      );
    },
    heal: (a, b) => {
      forEachEndpointPair(
        endpointsForNode(booted, a),
        endpointsForNode(booted, b),
        (x, y) => network.heal(x, y)
      );
    },
    healAll: () => network.healAll(),
    hold: (key) => network.hold(key),
    release: (key) => network.release(key),
    releaseAll: () => network.releaseAll(),
    advance: async (ms) => {
      await deps.scheduler.runFor(ms);
    },
    idle: async () => {
      await deps.scheduler.runUntilIdle();
    },
    until: (pred, o) => until(untilCtx, pred, o),
    never: (pred, o) => never(untilCtx, pred, o),
    settle: async () => {
      await system.settle(world);
      const inv = await system.invariants(world);
      throwIfInvariant(inv, deps.seed);
    },
    dispose: args.dispose,
    [Symbol.asyncDispose]: args.dispose,
  };
  return world;
}

/**
 * Framework-owned world: deps + network + topology nodes + optional facade.
 * Packages declare {@link defineSystem}; they do not mint SimDeps for worlds.
 */
export async function openWorld<S = unknown, M = object, F = unknown>(
  system: SystemDef<S, M, F>,
  opts: OpenWorldOpts
): Promise<World<S, F>> {
  const startMs = opts.startMs ?? system.startMs ?? 0;
  const deps = createSimDeps({
    seed: opts.seed,
    startMs,
    ...(opts.trace !== undefined ? { trace: opts.trace } : {}),
  });
  const networkDefaults: SimNetFaultProfile =
    opts.networkDefaults ?? system.network?.defaults ?? RELIABLE_NET_FAULTS;
  const rawNetwork = createSimNetwork({
    scheduler: deps.scheduler,
    rng: deps.rng.fork('net'),
    faults: networkDefaults,
    ...(deps.trace.enabled ? { trace: deps.trace } : {}),
  });
  const endpointRoles = new Map<string, string>();
  const edges = system.network?.edges ?? [];
  const network = wrapNetworkWithEdges(rawNetwork, edges, endpointRoles);
  const knobs = createKnobCatalog(system.knobs, opts.knobs);
  const faults = createFaultCatalog(system.faults ?? []);
  const stateBag = (system.state?.() ?? {}) as S;
  const { byRole, byId, booted } = await bootTopology(
    system as SystemDef<unknown>,
    { deps, network, knobs, faults, stateBag, endpointRoles }
  );
  const facadeSlot: { value: F } = { value: undefined as F };
  const world = assembleWorld({
    system: system as SystemDef<S, object, F>,
    deps,
    network,
    knobs,
    faults,
    stateBag,
    get facade() {
      return facadeSlot.value;
    },
    networkDefaults,
    startMs,
    byRole,
    byId,
    booted,
    dispose: makeDispose(booted, network),
  });
  if (system.facade !== undefined) {
    facadeSlot.value = await system.facade(world);
  }
  return world;
}

export type { OpenWorldOpts, World } from './world-types';
