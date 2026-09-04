import { asSeededRng, type Session } from '@pkgs/dst';
import { bootReplicaOnStore, type ReplicaBootConfig } from '../boot-replica';
import type { MatchmakingSimBackend } from '../sim-api';
import { openSimStore, type SimStore } from '../store';

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
  config: ReplicaBootConfig
): Promise<MmReplicaBootHandle> {
  const mm = await bootReplicaOnStore({
    store,
    clock: session.ports.clock,
    rng: asSeededRng(session.ports.rng as never),
    replicaId,
    config,
  });
  return { id: replicaId, mm };
}
