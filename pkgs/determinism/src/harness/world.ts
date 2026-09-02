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
  bindCommandKind,
  type CommandDef,
  type UnboundCommandDef,
} from './command';
import type { ScenarioDef } from './define-scenario';
import {
  createKnobCatalog,
  type KnobDef,
  type KnobValues,
  resolveKnobDefs,
} from './knobs';
import type { NodeEntry } from './node';
import { buildWorldControls } from './world-controls';
import { createWorldPorts, type WorldPorts } from './world-ports';
import type { NodeHandles, OpenWorldOptions, World } from './world-types';

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
  edges: readonly { readonly fromRole: string; readonly toRole: string }[],
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

function bindCommands(
  commands: Record<string, UnboundCommandDef>
): CommandDef[] {
  return Object.entries(commands).map(([kind, def]) =>
    bindCommandKind(kind, def)
  ) as CommandDef[];
}

function makeDispose(
  started: readonly StartedNode[],
  network: Network
): () => Promise<void> {
  let disposed = false;
  return async () => {
    if (disposed) return;
    disposed = true;
    for (let i = started.length - 1; i >= 0; i -= 1) {
      const n = started[i]!;
      for (const ep of n.endpointIds) network.unregister(ep);
      if (n.stop !== undefined) await n.stop();
    }
  };
}

function assembleWorld<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeEntry>,
  X,
>(args: {
  readonly scenario: ScenarioDef<K, N, object, X>;
  readonly boundCommands: CommandDef[];
  readonly ports: WorldPorts;
  readonly network: Network;
  readonly knobs: KnobValues<K>;
  readonly nodes: NodeHandles<N>;
  readonly networkFaults: NetworkFaults;
  readonly startTime: number;
  readonly started: StartedNode[];
  readonly dispose: () => Promise<void>;
  readonly extension: X;
}): World<K, N, X> {
  const worldRef: { current: World<K, N, X> | null } = { current: null };
  const controls = buildWorldControls({
    scenario: args.scenario,
    boundCommands: args.boundCommands,
    ctx: {
      ports: args.ports,
      network: args.network,
      started: args.started,
      startTime: args.startTime,
      networkFaults: args.networkFaults,
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

/**
 * Build a World from a Scenario: derive all ports from `seed`, create the
 * Network model, start every Node, bind Commands, then run `extend`.
 */
export async function openWorld<
  K extends Record<string, KnobDef>,
  N extends Record<string, NodeEntry>,
  M extends object = object,
  X = Record<string, never>,
>(
  scenario: ScenarioDef<K, N, M, X>,
  opts: OpenWorldOptions<K>
): Promise<World<K, N, X>> {
  const startTime = opts.startTime ?? scenario.startTime ?? 0;
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
  const network = wrapNetworkWithEdges(
    rawNetwork,
    scenario.network?.edges ?? [],
    endpointRoles
  );

  const catalog = createKnobCatalog(
    resolveKnobDefs(scenario.knobs),
    opts.knobs as Partial<KnobValues<K>> | undefined
  );
  const knobValues = catalog.toJSON() as Record<string, JsonValue>;

  const handlesOut: Record<string, unknown> = {};
  const { started } = await startTopology({
    ports,
    network,
    knobValues,
    knobGet: knobReader(scenario.knobs, catalog),
    endpointRoles,
    nodeEntries: scenario.nodes,
    handlesByRole: new Map(),
    handlesOut,
  });

  const baseWorld = assembleWorld({
    scenario: scenario as ScenarioDef<K, N, object, X>,
    boundCommands: bindCommands(scenario.commands),
    ports,
    network,
    knobs: catalog.values as KnobValues<K>,
    nodes: handlesOut as NodeHandles<N>,
    networkFaults,
    startTime,
    started,
    dispose: makeDispose(started, network),
    extension: {} as X,
  });

  const extension =
    scenario.extend !== undefined
      ? await scenario.extend(baseWorld)
      : ({} as X);

  if (typeof extension === 'object' && extension !== null) {
    for (const key of Object.keys(extension as object)) {
      if (key in baseWorld) {
        throw new Error(
          `openWorld(${scenario.id}): extend key collides with framework control ${key}`
        );
      }
    }
  }

  return Object.assign(baseWorld, extension) as World<K, N, X>;
}
