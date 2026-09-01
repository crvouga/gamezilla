import { defineNodeKind } from '@pkgs/determinism';

import { bootReplicaOnStore } from '../boot-replica';
import { buildReplicaHandle } from '../handles';
import { openSimStore, type SimStore } from '../store';
import type { MatchmakingSimBackend } from '../world-api';
import { type MatchmakingSystem, requireStore } from './system';

type StoreHandle = { readonly store: SimStore };
type ReplicaHandle = { readonly id: string };

/**
 * Shared SQL store for all replicas. Backend from knob `backend`.
 */
export const mmStoreNode = defineNodeKind<
  StoreHandle,
  StoreHandle,
  MatchmakingSystem
>({
  id: 'mm.store',
  boot: async (ctx) => {
    const backend = ctx.knobs.get('backend') as MatchmakingSimBackend;
    const store = await openSimStore(backend);
    ctx.state.store = store;
    return { store };
  },
  dispose: async (handle) => {
    await handle.store.close();
  },
  view: (h) => h,
});

/**
 * One matchmaking replica on the shared store.
 */
export const mmReplicaNode = defineNodeKind<
  ReplicaHandle,
  ReplicaHandle,
  MatchmakingSystem
>({
  id: 'mm.replica',
  boot: async (ctx) => {
    const state = ctx.state;
    const store = requireStore(state);
    const mm = await bootReplicaOnStore({
      store,
      clock: ctx.deps.clock,
      rng: ctx.deps.rng,
      replicaId: ctx.nodeId,
      config: {
        schema: state.schema,
        radius: state.radius,
        tuning: state.tuning,
      },
    });
    if (state.firstId === null) {
      state.firstId = ctx.nodeId;
      state.ops = {
        getMm: (replicaId) => {
          const r = state.replicas.get(replicaId);
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
    const ops = state.ops;
    if (ops === null) {
      throw new Error('mm.replica: ops missing');
    }
    const handle = buildReplicaHandle(ops, ctx.nodeId, mm);
    state.replicas.set(ctx.nodeId, handle);
    return { id: ctx.nodeId };
  },
  view: (h) => h,
});
