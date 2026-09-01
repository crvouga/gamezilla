/**
 * Build the matchmaking facade once store + replicas are up.
 */

import type { SimClock } from '@pkgs/determinism';
import type { SeededRng } from '@pkgs/uuid';

import { bootReplicaOnStore } from '../boot-replica';
import {
  buildReplicaHandle,
  joinOnWorld,
  resolveReplica,
  type WorldReplicaOps,
} from '../handles';
import {
  type NeverOpts,
  runWorldNever,
  runWorldUntil,
  type UntilOpts,
  type UntilTarget,
} from '../until';
import type { MatchmakingSimWorld, ReplicaHandle } from '../world-api';
import type { MatchmakingSystem } from './system';

export function buildMatchmakingFacade(args: {
  readonly system: MatchmakingSystem;
  readonly seed: bigint;
  readonly clock: SimClock;
  readonly rng: SeededRng;
}): MatchmakingSimWorld {
  const { system, seed, clock, rng } = args;
  const store = system.store;
  if (store === null) {
    throw new Error('buildMatchmakingFacade: store missing');
  }
  const replicas = system.replicas;
  const firstId = system.firstId;
  if (firstId === null) {
    throw new Error('buildMatchmakingFacade: no replicas');
  }
  const ops: WorldReplicaOps = {
    getMm: (replicaId) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: firstId,
  };
  system.ops = ops;

  const config = {
    schema: system.schema,
    radius: system.radius,
    tuning: system.tuning,
  };

  async function step(ms: number): Promise<void> {
    clock.advance(ms);
    await Promise.all(
      [...replicas.values()].map((r) => r.tick({ maxPassesPerPartition: 4 }))
    );
  }

  const untilCtx = { clock, seed, step };

  let disposed = false;
  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
  }

  return {
    seed,
    rng,
    clock,
    replicas,
    replica: (id) => resolveReplica(replicas, id),
    addReplica: async (id) => {
      if (replicas.has(id)) {
        throw new Error(`MatchmakingSimWorld: replica ${id} already exists`);
      }
      const mm = await bootReplicaOnStore({
        store,
        clock,
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
    runFor: async (ms) => {
      clock.advance(ms);
    },
    until: (target: UntilTarget, opts?: UntilOpts) =>
      runWorldUntil(untilCtx, target, opts),
    never: (target: UntilTarget, opts: NeverOpts) =>
      runWorldNever(untilCtx, target, opts),
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}

export type { ReplicaHandle };
