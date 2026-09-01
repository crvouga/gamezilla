import { createSimDeps } from './create-sim-deps';
import type { SystemDef } from './define-system';
import { createFaultCatalog } from './faults';
import type { JsonValue } from './json';
import { createKnobCatalog } from './knobs';
import {
  createSimNetwork,
  RELIABLE_NET_FAULTS,
  type SimNetFaultProfile,
} from './network';
import { type NodeInstance, requireNodeKind } from './node-kind';
import type { InvariantViolation } from './play';
import { never, until } from './until';
import type { OpenWorldOpts, World } from './world-types';

function resolveNodeCount(
  spec: { count?: number; countFromKnob?: string },
  knobs: { get: (id: string) => JsonValue }
): number {
  if (spec.countFromKnob !== undefined) {
    const v = knobs.get(spec.countFromKnob);
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new Error(
        `openWorld: knob ${spec.countFromKnob} must be non-negative number`
      );
    }
    return Math.floor(v);
  }
  return spec.count ?? 1;
}

function defaultNodeId(role: string, index: number, count: number): string {
  if (count === 1) return role;
  return `${role}${index}`;
}

type BootedNode = NodeInstance & {
  readonly dispose?: () => void | Promise<void>;
  readonly endpointIds: readonly string[];
};

async function bootTopology(
  system: SystemDef<unknown>,
  args: {
    readonly deps: ReturnType<typeof createSimDeps>;
    readonly network: ReturnType<typeof createSimNetwork>;
    readonly knobs: ReturnType<typeof createKnobCatalog>;
    readonly faults: ReturnType<typeof createFaultCatalog>;
    readonly systemBag: unknown;
  }
): Promise<{
  readonly byRole: Record<string, NodeInstance[]>;
  readonly byId: Map<string, NodeInstance>;
  readonly booted: BootedNode[];
}> {
  const byRole: Record<string, NodeInstance[]> = {};
  const byId = new Map<string, NodeInstance>();
  const booted: BootedNode[] = [];

  for (const spec of system.nodes) {
    const count = resolveNodeCount(spec, args.knobs);
    const kind = requireNodeKind(spec.kind);
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
        system: args.systemBag,
        nodesByRole: byRole,
        nodesById: byId,
      });
      const endpoints = kind.endpoints?.(handle) ?? [];
      for (const ep of endpoints) {
        args.network.register(ep.id, ep.deliver);
      }
      const view = kind.view?.(handle) ?? handle;
      const instance: NodeInstance = {
        id: nodeId,
        role: spec.role,
        kind: spec.kind,
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
  network: ReturnType<typeof createSimNetwork>
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

function assembleWorld<S>(args: {
  readonly system: SystemDef<S>;
  readonly deps: ReturnType<typeof createSimDeps>;
  readonly network: ReturnType<typeof createSimNetwork>;
  readonly knobs: ReturnType<typeof createKnobCatalog>;
  readonly faults: ReturnType<typeof createFaultCatalog>;
  readonly systemBag: S;
  readonly networkDefaults: SimNetFaultProfile;
  readonly startMs: number;
  readonly byRole: Record<string, NodeInstance[]>;
  readonly byId: Map<string, NodeInstance>;
  readonly dispose: () => Promise<void>;
}): World<S> {
  const { deps, network, system, systemBag, byRole, byId } = args;
  const untilCtx = {
    clock: deps.clock,
    scheduler: deps.scheduler,
    seed: deps.seed,
    heldSummary: () => network.heldSummary(),
  };
  let world!: World<S>;
  world = {
    seed: deps.seed,
    deps,
    clock: deps.clock,
    scheduler: deps.scheduler,
    network,
    system: systemBag,
    knobs: args.knobs,
    faults: args.faults,
    networkDefaults: args.networkDefaults,
    startMs: args.startMs,
    nodes: { byRole, byId },
    node: (role, id) => pickNode(byRole, byId, role, id),
    roleIds: (role) => (byRole[role] ?? []).map((n) => n.id),
    partition: (a, b) => network.partition(a, b),
    heal: (a, b) => network.heal(a, b),
    healAll: () => network.healAll(),
    hold: (key) => network.hold(key),
    release: (key) => network.release(key),
    releaseAll: () => network.releaseAll(),
    runFor: async (ms) => {
      await deps.scheduler.runFor(ms);
    },
    runUntilIdle: async (stepMs = 10) => {
      for (let i = 0; i < 64; i += 1) {
        const next = deps.scheduler.nextDueAt();
        if (next === null) return;
        const now = deps.clock.now();
        const delta = Math.max(stepMs, next - now);
        await deps.scheduler.runFor(delta);
      }
    },
    until: (target, o) => until(untilCtx, target, o),
    never: (target, o) => never(untilCtx, target, o),
    checkInvariants: async (): Promise<InvariantViolation | null> => {
      if (system.checkInvariants === undefined) return null;
      return system.checkInvariants(world);
    },
    assertConverged: async () => {
      await system.settle(world);
    },
    dispose: args.dispose,
    [Symbol.asyncDispose]: args.dispose,
  };
  return world;
}

/**
 * Framework-owned world: deps + network + topology nodes. Packages do not
 * supply openWorld for systems — they declare {@link defineSystem} systems.
 */
export async function openWorld<S = unknown>(
  system: SystemDef<S>,
  opts: OpenWorldOpts
): Promise<World<S>> {
  const startMs = opts.startMs ?? system.startMs ?? 0;
  const deps = createSimDeps({
    seed: opts.seed,
    startMs,
    ...(opts.trace !== undefined ? { trace: opts.trace } : {}),
  });
  const networkDefaults: SimNetFaultProfile =
    opts.networkDefaults ?? system.network?.defaults ?? RELIABLE_NET_FAULTS;
  const network = createSimNetwork({
    scheduler: deps.scheduler,
    rng: deps.rng.fork('net'),
    faults: networkDefaults,
  });
  const knobs = createKnobCatalog(system.knobs, opts.knobs);
  const faults = createFaultCatalog(system.faults ?? []);
  const systemBag = (system.system?.() ?? {}) as S;
  const { byRole, byId, booted } = await bootTopology(
    system as SystemDef<unknown>,
    { deps, network, knobs, faults, systemBag }
  );
  return assembleWorld({
    system,
    deps,
    network,
    knobs,
    faults,
    systemBag,
    networkDefaults,
    startMs,
    byRole,
    byId,
    dispose: makeDispose(booted, network),
  });
}

export type { OpenWorldOpts, World } from './world-types';
