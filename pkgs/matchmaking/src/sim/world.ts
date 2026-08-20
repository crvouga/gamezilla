/**
 * Deterministic matchmaking sim world: N Matchmaking replicas, one shared DB.
 */

import { createSimAdapters } from '@pkgs/uuid';
import { bootReplicaOnStore, type ReplicaBootConfig } from './boot-replica';
import { buildReplicaHandle, joinOnWorld, resolveReplica } from './handles';
import { resolveSeed } from './seed';
import { openSimStore, type SimStore } from './store';
import {
  type NeverOpts,
  runWorldNever,
  runWorldUntil,
  type UntilOpts,
  type UntilTarget,
} from './until';
import type {
  MatchmakingSimWorld,
  OpenMatchmakingSimWorldArgs,
  ReplicaHandle,
} from './world-api';

const DEFAULT_START_MS = 1_700_000_000_000;

function defaultReplicaIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `r${String(i)}`);
}

async function createWorldKernel(args: OpenMatchmakingSimWorldArgs): Promise<{
  readonly seed: bigint;
  readonly adapters: ReturnType<typeof createSimAdapters>;
  readonly store: SimStore;
  readonly config: ReplicaBootConfig;
  readonly replicas: Map<string, ReplicaHandle>;
  readonly firstId: string;
}> {
  const seed = resolveSeed(args.seed);
  const adapters = createSimAdapters({
    seed: args.seed,
    startMs: args.startMs ?? DEFAULT_START_MS,
  });
  const backend = args.backend ?? 'sqlite';
  const store = await openSimStore(backend);
  const config: ReplicaBootConfig = {
    schema: args.schema ?? {},
    radius: args.radius,
    tuning: args.tuning ?? {},
  };
  const ids = defaultReplicaIds(Math.max(1, args.replicas ?? 1));
  const replicas = new Map<string, ReplicaHandle>();
  const ops = {
    getMm: (replicaId: string) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: ids[0]!,
  };
  for (const id of ids) {
    const mm = await bootReplicaOnStore({
      store,
      clock: adapters.clock,
      rng: adapters.rng,
      replicaId: id,
      config,
    });
    replicas.set(id, buildReplicaHandle(ops, id, mm));
  }
  return { seed, adapters, store, config, replicas, firstId: ids[0]! };
}

/**
 * Open a deterministic matchmaking world. Use `await using` for cleanup.
 * Concurrent `tickAll` claim races need `backend: 'postgres'`.
 */
export async function openMatchmakingSimWorld(
  args: OpenMatchmakingSimWorldArgs
): Promise<MatchmakingSimWorld> {
  const kernel = await createWorldKernel(args);
  const { seed, adapters, store, config, replicas, firstId } = kernel;
  const ops = {
    getMm: (replicaId: string) => resolveReplica(replicas, replicaId).mm,
    defaultReplicaId: firstId,
  };

  async function step(ms: number): Promise<void> {
    adapters.clock.advance(ms);
    await Promise.all(
      [...replicas.values()].map((r) => r.tick({ maxPassesPerPartition: 4 }))
    );
  }

  const untilCtx = { clock: adapters.clock, seed, step };

  let disposed = false;
  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    await store.close();
  }

  const world: MatchmakingSimWorld = {
    seed,
    rng: adapters.rng,
    clock: adapters.clock,
    replicas,
    replica: (id) => resolveReplica(replicas, id),
    addReplica: async (id) => {
      if (replicas.has(id)) {
        throw new Error(`MatchmakingSimWorld: replica ${id} already exists`);
      }
      const mm = await bootReplicaOnStore({
        store,
        clock: adapters.clock,
        rng: adapters.rng,
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
      adapters.clock.advance(ms);
    },
    until: (target: UntilTarget, opts?: UntilOpts) =>
      runWorldUntil(untilCtx, target, opts),
    never: (target: UntilTarget, opts: NeverOpts) =>
      runWorldNever(untilCtx, target, opts),
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
  return world;
}

export type {
  MatchmakingSimWorld,
  OpenMatchmakingSimWorldArgs,
  ParticipantHandle,
  ReplicaHandle,
} from './world-api';
