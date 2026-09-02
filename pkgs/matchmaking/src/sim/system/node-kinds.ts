import { knob, node } from '@pkgs/determinism';
import fc from 'fast-check';

import { bootReplicaOnStore } from '../boot-replica';
import { openSimStore, type SimStore } from '../store';
import type { MatchmakingSimBackend } from '../world-api';
import type { MatchmakingSystemConfig } from './system';

export const MM_BACKEND = knob(
  'sqlite' as MatchmakingSimBackend,
  fc.constant('sqlite' as MatchmakingSimBackend)
);

export type MmStoreHandle = { readonly store: SimStore };

export type MmReplicaBootHandle = {
  readonly id: string;
  readonly mm: import('../../interface/matchmaking').Matchmaking;
};

/**
 * Shared SQL store for all replicas. Backend from knob `backend`.
 */
export const mmStoreNode = node({
  boot: async (ctx) => {
    const backend = ctx.knob(MM_BACKEND);
    const store = await openSimStore(backend);
    return { store };
  },
  dispose: async (handle) => {
    await handle.store.close();
  },
});

/**
 * One matchmaking replica on the shared store.
 */
export function mmReplicaNode(config: MatchmakingSystemConfig) {
  return node({
    boot: async (ctx) => {
      const storeHandle = ctx.peers.single('store') as MmStoreHandle;
      const mm = await bootReplicaOnStore({
        store: storeHandle.store,
        clock: ctx.deps.clock,
        rng: ctx.deps.rng,
        replicaId: ctx.id,
        config: {
          schema: config.schema,
          radius: config.radius,
          tuning: config.tuning,
        },
      });
      return { id: ctx.id, mm };
    },
  });
}
