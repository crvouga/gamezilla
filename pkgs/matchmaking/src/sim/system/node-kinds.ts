import { defineNodeKind } from '@pkgs/determinism';

import { bootReplicaOnStore } from '../boot-replica';
import { buildReplicaHandle } from '../handles';
import { openSimStore, type SimStore } from '../store';
import type { MatchmakingSimBackend } from '../world-api';
import { buildMatchmakingFacade } from './facade';
import { type MatchmakingSystem, requireStore } from './system';

export const MM_STORE = 'mm.store';
export const MM_REPLICA = 'mm.replica';
export const MM_WARMUP = 'mm.warmup';

defineNodeKind<{ readonly store: SimStore }, unknown, MatchmakingSystem>({
  id: MM_STORE,
  boot: async (ctx) => {
    const backend = ctx.knobs.get('backend') as MatchmakingSimBackend;
    const store = await openSimStore(backend);
    ctx.system.store = store;
    return { store };
  },
  dispose: async (handle) => {
    await handle.store.close();
  },
});

defineNodeKind<{ readonly id: string }, unknown, MatchmakingSystem>({
  id: MM_REPLICA,
  boot: async (ctx) => {
    const system = ctx.system;
    const store = requireStore(system);
    const mm = await bootReplicaOnStore({
      store,
      clock: ctx.deps.clock,
      rng: ctx.deps.rng,
      replicaId: ctx.nodeId,
      config: {
        schema: system.schema,
        radius: system.radius,
        tuning: system.tuning,
      },
    });
    if (system.firstId === null) {
      system.firstId = ctx.nodeId;
      system.ops = {
        getMm: (replicaId) => {
          const r = system.replicas.get(replicaId);
          if (r === undefined) {
            throw new Error(
              `MatchmakingSimWorld: unknown replica ${replicaId}`
            );
          }
          return r.mm;
        },
        defaultReplicaId: ctx.nodeId,
      };
    }
    const ops = system.ops;
    if (ops === null) {
      throw new Error('mm.replica: ops missing');
    }
    const handle = buildReplicaHandle(ops, ctx.nodeId, mm);
    system.replicas.set(ctx.nodeId, handle);
    return { id: ctx.nodeId };
  },
});

/** Assemble the scenario facade after all replicas are up. */
defineNodeKind<{ readonly id: string }, unknown, MatchmakingSystem>({
  id: MM_WARMUP,
  boot: (ctx) => {
    const facade = buildMatchmakingFacade({
      system: ctx.system,
      seed: ctx.deps.seed,
      clock: ctx.deps.clock,
      rng: ctx.deps.rng,
    });
    ctx.system.facade = facade;
    return { id: ctx.nodeId };
  },
});
