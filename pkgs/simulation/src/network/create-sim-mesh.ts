import type { EdgeKind } from '../topology';
import { edgeKey } from './edge-key';
import {
  applyDirectionalState,
  getOrThrow,
  normalizeFailWith,
  shuffleInPlace,
  toLiveSnapshot,
} from './mesh-edge-ops';
import { meshSend } from './mesh-send';
import type {
  CreateSimMeshArgs,
  EdgeRuntime,
  PartitionOpts,
  ReleaseOpts,
  SimMesh,
} from './mesh-types';

export function createSimMesh(args: CreateSimMeshArgs): SimMesh {
  const edges = new Map<string, EdgeRuntime>();
  const paused = new Set<string>();
  let msgSeq = 0;
  return buildMeshApi({
    args,
    edges,
    paused,
    nextMsgId: () => {
      msgSeq += 1;
      return `m-${msgSeq}`;
    },
  });
}

function buildMeshApi(ctx: {
  readonly args: CreateSimMeshArgs;
  readonly edges: Map<string, EdgeRuntime>;
  readonly paused: Set<string>;
  readonly nextMsgId: () => string;
}): SimMesh {
  const { args, edges, paused } = ctx;
  const sendDeps = {
    rng: args.rng,
    events: args.events,
    schedule: args.schedule,
    paused,
    nextMsgId: ctx.nextMsgId,
  };
  return {
    ...meshRegistryOps(edges, paused),
    ...meshLinkOps(args, edges),
    ...meshRateOps(args, edges),
    setNodePaused(nodeId, next) {
      if (next) paused.add(nodeId);
      else paused.delete(nodeId);
    },
    isNodePaused: (nodeId) => paused.has(nodeId),
    send: (sendArgs) =>
      meshSend(
        sendDeps,
        getOrThrow(edges, sendArgs.from, sendArgs.to),
        sendArgs
      ),
    takeFailWith(from, to) {
      const edge = getOrThrow(edges, from, to);
      if (edge.failWithRemaining <= 0 || edge.failWith === null) return null;
      edge.failWithRemaining -= 1;
      return edge.failWith;
    },
    getEdge(from, to) {
      return (
        edges.get(edgeKey(from, to)) ?? edges.get(edgeKey(to, from)) ?? null
      );
    },
  };
}

function meshRegistryOps(
  edges: Map<string, EdgeRuntime>,
  paused: Set<string>
): Pick<
  SimMesh,
  'registerEdge' | 'unregisterNode' | 'edgeSnapshot' | 'listEdges'
> {
  return {
    registerEdge(from, to, kind: EdgeKind) {
      const key = edgeKey(from, to);
      if (edges.has(key) || edges.has(edgeKey(to, from))) return;
      edges.set(key, emptyEdge(from, to, kind));
    },
    unregisterNode(nodeId) {
      for (const [key, edge] of [...edges]) {
        if (edge.from === nodeId || edge.to === nodeId) edges.delete(key);
      }
      paused.delete(nodeId);
    },
    edgeSnapshot(from, to) {
      const edge = edges.get(edgeKey(from, to)) ?? edges.get(edgeKey(to, from));
      return edge ? toLiveSnapshot(edge) : null;
    },
    listEdges: () => [...edges.values()].map(toLiveSnapshot),
  };
}

function meshLinkOps(
  args: CreateSimMeshArgs,
  edges: Map<string, EdgeRuntime>
): Pick<SimMesh, 'partition' | 'heal' | 'hold' | 'release'> {
  return {
    partition(from, to, opts) {
      setLink({
        args,
        edges,
        from,
        to,
        state: 'down',
        opts,
        kind: 'edge.partition',
      });
    },
    heal(from, to, opts) {
      setLink({
        args,
        edges,
        from,
        to,
        state: 'ok',
        opts,
        kind: 'edge.heal',
      });
    },
    hold(from, to, opts) {
      setLink({
        args,
        edges,
        from,
        to,
        state: 'hold',
        opts,
        kind: 'edge.hold',
      });
    },
    release: (from, to, opts) =>
      releaseEdge({
        args,
        edges,
        from,
        to,
        ...(opts !== undefined ? { opts } : {}),
      }),
  };
}

function meshRateOps(
  args: CreateSimMeshArgs,
  edges: Map<string, EdgeRuntime>
): Pick<SimMesh, 'latency' | 'jitter' | 'drop' | 'duplicate' | 'failWith'> {
  return {
    latency(from, to, ms) {
      getOrThrow(edges, from, to).latencyMs = Math.max(0, ms);
    },
    jitter(from, to, ms) {
      getOrThrow(edges, from, to).jitterMs = Math.max(0, ms);
    },
    drop(from, to, rate) {
      getOrThrow(edges, from, to).dropRate = clamp01(rate);
    },
    duplicate(from, to, rate) {
      getOrThrow(edges, from, to).duplicateRate = clamp01(rate);
    },
    failWith(from, to, spec, opts) {
      armFailWith({ args, edges, from, to, spec, times: opts.times });
    },
  };
}

function emptyEdge(from: string, to: string, kind: EdgeKind): EdgeRuntime {
  return {
    from,
    to,
    kind,
    stateFrom: 'ok',
    stateTo: 'ok',
    latencyMs: 0,
    jitterMs: 0,
    dropRate: 0,
    duplicateRate: 0,
    failWith: null,
    failWithRemaining: 0,
    holdQueue: [],
  };
}

function setLink(ctx: {
  readonly args: CreateSimMeshArgs;
  readonly edges: Map<string, EdgeRuntime>;
  readonly from: string;
  readonly to: string;
  readonly state: 'ok' | 'hold' | 'down';
  readonly opts: PartitionOpts | undefined;
  readonly kind: 'edge.partition' | 'edge.heal' | 'edge.hold';
}): void {
  const edge = getOrThrow(ctx.edges, ctx.from, ctx.to);
  applyDirectionalState(
    edge,
    ctx.opts?.direction ?? 'both',
    ctx.state,
    'canonical'
  );
  ctx.args.events.append({
    kind: ctx.kind,
    from: ctx.from,
    to: ctx.to,
    detail: `direction=${ctx.opts?.direction ?? 'both'}, state=${ctx.state}`,
  });
}

async function releaseEdge(ctx: {
  readonly args: CreateSimMeshArgs;
  readonly edges: Map<string, EdgeRuntime>;
  readonly from: string;
  readonly to: string;
  readonly opts?: ReleaseOpts;
}): Promise<void> {
  const edge = getOrThrow(ctx.edges, ctx.from, ctx.to);
  applyDirectionalState(edge, 'both', 'ok', 'canonical');
  const queue = edge.holdQueue.splice(0, edge.holdQueue.length);
  if (ctx.opts?.reorder === true && queue.length > 1) {
    shuffleInPlace(queue, ctx.args.rng.random);
    ctx.args.events.append({
      kind: 'edge.reorder',
      from: ctx.from,
      to: ctx.to,
      detail: `count=${queue.length}`,
    });
  }
  ctx.args.events.append({
    kind: 'edge.release',
    from: ctx.from,
    to: ctx.to,
    detail: `count=${queue.length}, reorder=${ctx.opts?.reorder === true}`,
  });
  for (const msg of queue) {
    await Promise.resolve(msg.deliver());
  }
}

function armFailWith(ctx: {
  readonly args: CreateSimMeshArgs;
  readonly edges: Map<string, EdgeRuntime>;
  readonly from: string;
  readonly to: string;
  readonly spec: Parameters<SimMesh['failWith']>[2];
  readonly times: number;
}): void {
  const edge = getOrThrow(ctx.edges, ctx.from, ctx.to);
  edge.failWith = normalizeFailWith(ctx.spec);
  edge.failWithRemaining = Math.max(0, ctx.times);
  ctx.args.events.append({
    kind: 'edge.failWith',
    from: ctx.from,
    to: ctx.to,
    detail: `times=${ctx.times}`,
    meta: { spec: edge.failWith },
  });
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export type { FailWithSpec, SimMesh } from './mesh-types';
