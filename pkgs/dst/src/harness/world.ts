import { bindInvariantSink, unbindInvariantSink } from '@pkgs/invariants';
import type { JsonValue } from '../kernel/json';
import {
  createNetwork,
  type Network,
  type NetworkFaults,
  RELIABLE_NETWORK,
} from '../models/network';
import {
  defaultNodeId,
  isCountedNode,
  type Peers,
  resolveNodeCount,
} from '../models/node';
import {
  type ActionCatalog,
  type ActionDef,
  bindActionKind,
  type UnboundActionDef,
} from './actions';
import type { ScenarioDef } from './define-scenario';
import {
  createKnobCatalog,
  type KnobDef,
  type KnobValues,
  resolveKnobDefs,
} from './knobs';
import type { NodeEntry } from './node';
import { createPropertyRunner } from './property-runner';
import { buildWorldControls } from './world-controls';
import { createWorldPorts, type WorldPorts } from './world-ports';
import type {
  NetworkEdge,
  NodeHandles,
  OpenWorldOptions,
  World,
} from './world-types';

type StartedNode = {
  readonly id: string;
  readonly role: string;
  readonly endpointIds: readonly string[];
  readonly stop?: () => void | Promise<void>;
};

function peersFor(handlesByRole: Map<string, Map<string, unknown>>): Peers {
  return {
    single: (r) => {
      const m = handlesByRole.get(r);
      if (m === undefined || m.size !== 1) {
        throw new Error(`peers.single: role ${r} is not a singleton`);
      }
      return [...m.values()][0];
    },
    get: (r, id) => {
      const h = handlesByRole.get(r)?.get(id);
      if (h === undefined) {
        throw new Error(`peers.get: no ${r} with id ${id}`);
      }
      return h;
    },
    nodeIds: (r) => [...(handlesByRole.get(r)?.keys() ?? [])],
  };
}

async function startTopology(args: {
  readonly ports: WorldPorts;
  readonly network: Network;
  readonly knobValues: Record<string, JsonValue>;
  readonly knobGet: <T extends JsonValue>(def: { readonly default: T }) => T;
  readonly endpointRoles: Map<string, string>;
  readonly nodeEntries: Record<string, NodeEntry>;
  readonly handlesByRole: Map<string, Map<string, unknown>>;
  readonly handlesOut: Record<string, unknown>;
}): Promise<{ readonly started: StartedNode[] }> {
  const started: StartedNode[] = [];
  const peers = peersFor(args.handlesByRole);

  for (const [role, def] of Object.entries(args.nodeEntries)) {
    const count = resolveNodeCount(def, args.knobValues);
    const map = new Map<string, unknown>();
    args.handlesByRole.set(role, map);

    for (let index = 0; index < count; index += 1) {
      const nodeId = defaultNodeId(
        role,
        index,
        count,
        isCountedNode(def) ? def.id : undefined
      );
      const eps: string[] = [];
      const listen = (
        deliver: (payload: unknown) => void | Promise<void>,
        endpointId = nodeId
      ) => {
        args.network.register(endpointId, deliver);
        args.endpointRoles.set(endpointId, role);
        eps.push(endpointId);
      };

      const handle = await def.start({
        id: nodeId,
        role,
        index,
        ports: args.ports,
        network: args.network,
        knob: args.knobGet,
        peers,
        listen,
      });

      map.set(nodeId, handle);
      started.push({
        id: nodeId,
        role,
        endpointIds: eps,
        ...(def.stop !== undefined ? { stop: () => def.stop!(handle) } : {}),
      });
    }

    args.handlesOut[role] = isCountedNode(def)
      ? (map as ReadonlyMap<string, unknown>)
      : map.values().next().value;
  }

  return { started };
}

function wrapNetworkWithEdges(
  network: Network,
  edges: readonly NetworkEdge[],
  endpointRoles: Map<string, string>
): Network {
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
            `Network.send: undeclared edge ${fr}→${tr} (from=${from} to=${to})`
          );
        }
      }
      network.send(from, to, payload, opts);
    },
  };
}

function bindActions<S>(
  actions: ActionCatalog<S>
): ActionDef<unknown, unknown>[] {
  return Object.entries(actions).map(([kind, def]) =>
    bindActionKind(kind, def as UnboundActionDef<unknown, S>)
  ) as ActionDef<unknown, unknown>[];
}

function makeDispose(
  started: readonly StartedNode[],
  network: Network
): () => Promise<void> {
  let disposed = false;
  return async () => {
    if (disposed) return;
    disposed = true;
    unbindInvariantSink();
    for (let i = started.length - 1; i >= 0; i -= 1) {
      const n = started[i]!;
      for (const ep of n.endpointIds) network.unregister(ep);
      if (n.stop !== undefined) await n.stop();
    }
  };
}

function knobReader<K extends Record<string, KnobDef>>(
  knobs: K,
  catalog: { readonly get: (id: keyof KnobValues<K> & string) => unknown }
): <T extends JsonValue>(def: { readonly default: T }) => T {
  const defToId = new Map<object, string>();
  for (const [id, def] of Object.entries(knobs)) {
    defToId.set(def, id);
  }
  return <T extends JsonValue>(def: { readonly default: T }): T => {
    const id = defToId.get(def);
    if (id === undefined) {
      throw new Error('ctx.knob: unknown KnobDef');
    }
    return catalog.get(id as keyof KnobValues<K> & string) as T;
  };
}

const EXTEND_OVERRIDABLE_KEYS = new Set(['waitUntil']);

function assertExtendKeys(
  scenarioId: string,
  baseWorld: object,
  extension: object
): void {
  for (const key of Object.keys(extension)) {
    if (key in baseWorld && !EXTEND_OVERRIDABLE_KEYS.has(key)) {
      throw new Error(
        `openWorld(${scenarioId}): extend key collides with framework control ${key}`
      );
    }
  }
}

async function abortOpenWorld(
  dispose: (() => Promise<void>) | undefined,
  started: readonly StartedNode[]
): Promise<void> {
  if (dispose !== undefined) {
    await dispose();
    return;
  }
  unbindInvariantSink();
  for (let i = started.length - 1; i >= 0; i -= 1) {
    const n = started[i]!;
    if (n.stop !== undefined) await n.stop();
  }
}

/**
 * Build a World from a Scenario: derive all ports from `seed`, create the
 * Network model, start every Node, bind Actions, then run `extend`.
 */
export async function openWorld<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeEntry>,
  S,
  X extends S,
>(
  scenario: ScenarioDef<K, N, S, X>,
  opts: OpenWorldOptions<K>
): Promise<World<K, N, X>> {
  bindInvariantSink();
  let dispose: (() => Promise<void>) | undefined;
  let started: StartedNode[] = [];
  try {
    const startTime = opts.startTime ?? scenario.startTime ?? 0;
    const edges = scenario.network?.edges ?? [];
    const ports = createWorldPorts({
      seed: opts.seed,
      startTime,
      ...(opts.trace !== undefined ? { trace: opts.trace } : {}),
    });
    const networkFaults: NetworkFaults =
      opts.networkFaults ?? scenario.network?.faults ?? RELIABLE_NETWORK;
    const rawNetwork = createNetwork({
      scheduler: ports.scheduler,
      rng: ports.rng.fork('net'),
      faults: networkFaults,
      ...(ports.trace.enabled ? { trace: ports.trace } : {}),
    });
    const endpointRoles = new Map<string, string>();
    const network = wrapNetworkWithEdges(rawNetwork, edges, endpointRoles);

    const catalog = createKnobCatalog(
      resolveKnobDefs(scenario.knobs),
      opts.knobs as Partial<KnobValues<K>> | undefined
    );

    const handlesOut: Record<string, unknown> = {};
    ({ started } = await startTopology({
      ports,
      network,
      knobValues: catalog.toJSON() as Record<string, JsonValue>,
      knobGet: knobReader(scenario.knobs, catalog),
      endpointRoles,
      nodeEntries: scenario.nodes,
      handlesByRole: new Map(),
      handlesOut,
    }));

    dispose = makeDispose(started, network);
    const propertyRunner = createPropertyRunner<S>(scenario.properties);
    const boundActions = bindActions(scenario.actions);

    const worldRef: { current: World<K, N, X> | null } = { current: null };
    const controls = buildWorldControls({
      scenario,
      boundActions,
      ctx: {
        ports,
        network,
        started,
        startTime,
        networkFaults,
        edges,
        dispose,
      },
      worldRef,
      propertyRunner,
    });

    const baseWorld = Object.assign(controls, {
      knobs: catalog.values as KnobValues<K>,
      nodes: handlesOut as NodeHandles<N>,
    }) as World<K, N, X>;
    worldRef.current = baseWorld;

    const extension =
      scenario.extend !== undefined
        ? await scenario.extend(baseWorld)
        : ({} as X);

    if (typeof extension === 'object' && extension !== null) {
      assertExtendKeys(scenario.id, baseWorld, extension as object);
    }

    return Object.assign(baseWorld, extension) as World<K, N, X>;
  } catch (error) {
    await abortOpenWorld(dispose, started);
    throw error;
  }
}
