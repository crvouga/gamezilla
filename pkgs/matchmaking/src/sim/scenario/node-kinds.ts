import type { Session } from '@pkgs/dst';
import { asSeededRng } from '@pkgs/dst/kernel';
import { bootReplicaOnStore } from '../boot-replica';
import type { MatchmakingSimBackend } from '../sim-api';
import { openSimStore, type SimStore } from '../store';
import type { MatchmakingSystemConfig } from './system';

export type MmStoreHandle = { readonly store: SimStore };

export type MmReplicaBootHandle = {
  readonly id: string;
  readonly mm: import('../../interface/matchmaking').Matchmaking;
};

export async function startStore(
  _session: Session,
  backend: MatchmakingSimBackend
): Promise<MmStoreHandle> {
  const store = await openSimStore(backend);
  return { store };
}

export async function startReplica(
  session: Session,
  store: SimStore,
  replicaId: string,
  config: MatchmakingSystemConfig
): Promise<MmReplicaBootHandle> {
  const mm = await bootReplicaOnStore({
    store,
    clock: session.ports.clock,
    rng: asSeededRng(session.ports.rng as never),
    replicaId,
    config: {
      schema: config.schema,
      radius: config.radius,
      tuning: config.tuning,
    },
  });
  return { id: replicaId, mm };
}

export async function disposeStore(handle: MmStoreHandle): Promise<void> {
  await handle.store.close();
}
