/**
 * Kit methods merged onto the framework world via `extend`.
 */

import type { World } from '@pkgs/dst';
import type { SeededRng } from '@pkgs/uuid';

import { bootReplicaOnStore } from '../boot-replica';
import {
  buildReplicaHandle,
  joinOnWorld,
  resolveReplica,
  type WorldReplicaOps,
} from '../handles';
import {
  type EventuallyOptions,
  type NeverOptions,
  runWorldNever,
  runWorldUntil,
  type UntilTarget,
} from '../until';
import type {
  MatchmakingSimKit,
  MatchmakingSimWorld,
  ReplicaHandle,
} from '../world-api';
import type { MmReplicaBootHandle, MmStoreHandle } from './node-kinds';
import type { MatchmakingSystemConfig } from './system';

type MatchmakingFrameworkWorld = World<
  Record<string, import('@pkgs/dst').KnobDef>,
  Record<string, import('@pkgs/dst').NodeEntry>,
  MatchmakingSimKit
>;

function buildReplicaMap(
  world: MatchmakingFrameworkWorld
): Map<string, ReplicaHandle> {
  const bootMap = world.nodes['replica'] as ReadonlyMap<
    string,
    MmReplicaBootHandle
  >;
  const replicaIds = world.nodeIds('replica');
  const firstId = replicaIds[0];
  if (firstId === undefined) {
    throw new Error('buildMatchmakingKit: no replicas booted');
  }
  const replicas = new Map<string, ReplicaHandle>();
  const ops: WorldReplicaOps = {
    getMm: (replicaId) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: firstId,
  };
  for (const id of replicaIds) {
    const boot = bootMap.get(id);
    if (boot === undefined) {
      throw new Error(`buildMatchmakingKit: missing replica ${id}`);
    }
    replicas.set(id, buildReplicaHandle(ops, id, boot.mm));
  }
  return replicas;
}

export function buildMatchmakingKit(args: {
  readonly world: MatchmakingFrameworkWorld;
  readonly config: MatchmakingSystemConfig;
  readonly rng: SeededRng;
}): MatchmakingSimKit {
  const { world, config, rng } = args;
  const store = (world.nodes['store'] as MmStoreHandle).store;
  const replicas = buildReplicaMap(world);
  const firstId = world.nodeIds('replica')[0]!;
  const ops: WorldReplicaOps = {
    getMm: (replicaId) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: firstId,
  };

  async function step(ms: number): Promise<void> {
    await world.advance(ms);
    await Promise.all(
      [...replicas.values()].map((r) => r.tick({ maxPassesPerPartition: 4 }))
    );
  }

  const untilCtx = {
    clock: { now: () => world.now() },
    seed: world.seed,
    step,
  };

  return {
    replicas,
    replica: (id) => resolveReplica(replicas, id),
    addReplica: async (id) => {
      if (replicas.has(id)) {
        throw new Error(`MatchmakingSimWorld: replica ${id} already exists`);
      }
      const mm = await bootReplicaOnStore({
        store,
        clock: world.ports.clock,
        rng,
        replicaId: id,
        config,
      });
      const handle = buildReplicaHandle(ops, id, mm);
      replicas.set(id, handle);
      return handle;
    },
    get mm() {
      return resolveReplica(replicas, firstId).mm;
    },
    join: (input, replicaId) =>
      joinOnWorld({ replicas, ops, firstId }, input, replicaId),
    tick: (opts, replicaId) =>
      resolveReplica(replicas, replicaId ?? firstId).tick(opts),
    tickAll: (opts) =>
      Promise.all([...replicas.values()].map((r) => r.tick(opts))),
    waitUntil: (target: UntilTarget, opts?: EventuallyOptions) =>
      runWorldUntil(untilCtx, target, opts),
    waitNever: (target: UntilTarget, opts: NeverOptions) =>
      runWorldNever(untilCtx, target, opts),
  };
}

export async function assertReplicaAgreement(
  world: MatchmakingSimWorld
): Promise<void> {
  const replicaIds = [...world.replicas.keys()];
  if (replicaIds.length === 0) {
    throw new Error('matchmaking.no-replicas: kit has no replicas');
  }
  const probeId = '00000000-0000-0000-0000-000000000000';
  let first: unknown;
  for (let i = 0; i < replicaIds.length; i += 1) {
    const id = replicaIds[i]!;
    const r = world.replicas.get(id);
    if (r === undefined) {
      throw new Error(`matchmaking.missing-replica: replica ${id} missing`);
    }
    const st = await r.mm.status(probeId);
    if (i === 0) first = st;
    else if (JSON.stringify(st) !== JSON.stringify(first)) {
      throw new Error(
        `matchmaking.replica-diverge: replica ${id} status disagrees with ${replicaIds[0]}`
      );
    }
  }
}

export type { ReplicaHandle };
