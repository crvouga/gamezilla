import { type ActionDef, bindActionKind } from './action';
import { createSimDeps } from './create-sim-deps';
import type { SystemDef } from './define-system';
import type { JsonValue } from './json';
import {
  createKnobCatalog,
  type KnobDef,
  type KnobValues,
  resolveKnobDefs,
} from './knobs';
import {
  createSimNetwork,
  RELIABLE_NET_FAULTS,
  type SimNetFaultProfile,
  type SimNetwork,
} from './network';
import {
  defaultNodeId,
  isCountedNode,
  type NodeSpecEntry,
  resolveNodeCount,
} from './node';
import { buildWorldControls } from './world-controls';
import type { NodeHandles, OpenWorldOpts, World } from './world-types';

type BootedNode = {
  readonly id: string;
  readonly role: string;
  readonly endpointIds: readonly string[];
  readonly dispose?: () => void | Promise<void>;
};

async function bootTopology(args: {
  readonly deps: ReturnType<typeof createSimDeps>;
  readonly network: SimNetwork;
  readonly knobValues: Record<string, JsonValue>;
  readonly knobGet: <T extends JsonValue>(def: KnobDef<T>) => T;
  readonly endpointRoles: Map<string, string>;
  readonly nodeEntries: Record<string, NodeSpecEntry>;
  readonly handlesByRole: Map<string, Map<string, unknown>>;
  readonly handlesOut: Record<string, unknown>;
}): Promise<{ readonly booted: BootedNode[] }> {
  const booted: BootedNode[] = [];

  for (const [role, spec] of Object.entries(args.nodeEntries)) {
    const count = resolveNodeCount(spec, args.knobValues);
    const map = new Map<string, unknown>();
    args.handlesByRole.set(role, map);

    for (let index = 0; index < count; index += 1) {
      const nodeId = defaultNodeId(
        role,
        index,
        count,
        isCountedNode(spec) ? spec.id : undefined
      );

      const peers = {
        single: (r: string) => {
          const m = args.handlesByRole.get(r);
          if (m === undefined || m.size !== 1) {
            throw new Error(`peers.single: role ${r} is not a singleton`);
          }
          return [...m.values()][0];
        },
        get: (r: string, id: string) => {
          const h = args.handlesByRole.get(r)?.get(id);
          if (h === undefined) {
            throw new Error(`peers.get: no ${r} with id ${id}`);
          }
          return h;
        },
        ids: (r: string) => [...(args.handlesByRole.get(r)?.keys() ?? [])],
      };

      const eps: string[] = [];
      const listen = (
        deliver: (payload: unknown) => void | Promise<void>,
        endpointId = nodeId
      ) => {
        args.network.register(endpointId, deliver);
        args.endpointRoles.set(endpointId, role);
        eps.push(endpointId);
      };

      const handle = await spec.boot({
        id: nodeId,
        role,
        index,
        deps: args.deps,
        network: args.network,
        knob: args.knobGet,
        peers,
        listen,
      });

      map.set(nodeId, handle);
      booted.push({
        id: nodeId,
        role,
        endpointIds: eps,
        ...(spec.dispose !== undefined
          ? { dispose: () => spec.dispose!(handle) }
          : {}),
      });
    }

    args.handlesOut[role] = isCountedNode(spec)
      ? (map as ReadonlyMap<string, unknown>)
      : map.values().next().value;
  }

  return { booted };
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

function bindActions(
  actions: Record<string, import('./action').UnboundActionDef>
): ActionDef[] {
  return Object.entries(actions).map(([kind, def]) =>
    bindActionKind(kind, def)
  ) as ActionDef[];
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

function assembleWorld<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeSpecEntry>,
  X,
>(args: {
  readonly system: SystemDef<K, N, object, X>;
  readonly boundActions: ActionDef[];
  readonly deps: ReturnType<typeof createSimDeps>;
  readonly network: SimNetwork;
  readonly knobs: KnobValues<K>;
  readonly nodes: NodeHandles<N>;
  readonly networkDefaults: SimNetFaultProfile;
  readonly startMs: number;
  readonly booted: BootedNode[];
  readonly dispose: () => Promise<void>;
  readonly extension: X;
}): World<K, N, X> {
  const worldRef: { current: World<K, N, X> | null } = { current: null };
  const controls = buildWorldControls({
    system: args.system,
    boundActions: args.boundActions,
    ctx: {
      deps: args.deps,
      network: args.network,
      booted: args.booted,
      startMs: args.startMs,
      networkDefaults: args.networkDefaults,
      dispose: args.dispose,
    },
    worldRef,
  });
  const world = Object.assign(controls, {
    knobs: args.knobs,
    nodes: args.nodes,
    ...args.extension,
  }) as World<K, N, X>;
  worldRef.current = world;
  return world;
}

export async function openWorld<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeSpecEntry>,
  M extends object = object,
  X = Record<string, never>,
>(
  system: SystemDef<K, N, M, X>,
  opts: OpenWorldOpts<K>
): Promise<World<K, N, X>> {
  const startMs = opts.startMs ?? system.startMs ?? 0;
  const deps = createSimDeps({
    seed: opts.seed,
    startMs,
    ...(opts.trace !== undefined ? { trace: opts.trace } : {}),
  });
  const networkDefaults: SimNetFaultProfile =
    opts.networkDefaults ?? system.network?.faults ?? RELIABLE_NET_FAULTS;
  const rawNetwork = createSimNetwork({
    scheduler: deps.scheduler,
    rng: deps.rng.fork('net'),
    faults: networkDefaults,
    ...(deps.trace.enabled ? { trace: deps.trace } : {}),
  });
  const endpointRoles = new Map<string, string>();
  const network = wrapNetworkWithEdges(
    rawNetwork,
    system.network?.edges ?? [],
    endpointRoles
  );

  const knobDefs = resolveKnobDefs(system.knobs);
  const catalog = createKnobCatalog(
    knobDefs,
    opts.knobs as Partial<KnobValues<K>> | undefined
  );
  const knobValues = catalog.toJSON() as Record<string, JsonValue>;
  const defToId = new Map<KnobDef, string>();
  for (const [id, def] of Object.entries(system.knobs)) {
    defToId.set(def, id);
  }
  const knobGet = <T extends JsonValue>(def: KnobDef<T>): T => {
    const id = defToId.get(def);
    if (id === undefined) {
      throw new Error('ctx.knob: unknown KnobDef');
    }
    return catalog.get(id as keyof KnobValues<K> & string) as unknown as T;
  };

  const handlesOut: Record<string, unknown> = {};
  const { booted } = await bootTopology({
    deps,
    network,
    knobValues,
    knobGet,
    endpointRoles,
    nodeEntries: system.nodes,
    handlesByRole: new Map(),
    handlesOut,
  });

  const boundActions = bindActions(system.actions);
  const baseWorld = assembleWorld({
    system: system as SystemDef<K, N, object, X>,
    boundActions,
    deps,
    network,
    knobs: catalog.values as KnobValues<K>,
    nodes: handlesOut as NodeHandles<N>,
    networkDefaults,
    startMs,
    booted,
    dispose: makeDispose(booted, network),
    extension: {} as X,
  });

  const extension =
    system.extend !== undefined ? await system.extend(baseWorld) : ({} as X);

  if (typeof extension === 'object' && extension !== null) {
    for (const key of Object.keys(extension as object)) {
      if (key in baseWorld) {
        throw new Error(
          `openWorld(${system.id}): extend key collides with framework control ${key}`
        );
      }
    }
  }

  return Object.assign(baseWorld, extension) as World<K, N, X>;
}

export type { OpenWorldOpts, World } from './world-types';
