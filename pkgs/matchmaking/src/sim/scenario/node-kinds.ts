import { knob, node } from '@pkgs/dst';
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
  start: async (ctx) => {
    const backend = ctx.knob(MM_BACKEND);
    const store = await openSimStore(backend);
    return { store };
  },
  stop: async (handle) => {
    await handle.store.close();
  },
});

/**
 * One matchmaking replica on the shared store.
 */
export function mmReplicaNode(config: MatchmakingSystemConfig) {
  return node({
    start: async (ctx) => {
      const storeHandle = ctx.peers.single('store') as MmStoreHandle;
      const mm = await bootReplicaOnStore({
        store: storeHandle.store,
        clock: ctx.ports.clock,
        rng: ctx.ports.rng,
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
