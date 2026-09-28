import { asSeededRng, type Session } from '@pkgs/harness';
import { bootReplicaOnStore, type ReplicaBootConfig } from '../boot-replica';
import type { MatchmakingHarnessBackend } from '../harness-api';
import { type HarnessStore, openHarnessStore } from '../store';

export type MmStore = { readonly store: HarnessStore };

export type MmReplicaBoot = {
  readonly id: string;
  readonly mm: import('@pkgs/matchmaking/interface').Matchmaking;
};

export async function startStore(
  _session: Session,
  backend: MatchmakingHarnessBackend
): Promise<MmStore> {
  const store = await openHarnessStore(backend);
  return { store };
}

export async function startReplica(
  session: Session,
  store: HarnessStore,
  replicaId: string,
  config: ReplicaBootConfig
): Promise<MmReplicaBoot> {
  const mm = await bootReplicaOnStore({
    store,
    clock: session.ports.clock,
    rng: asSeededRng(session.ports.rng as never),
    replicaId,
    config,
  });
  return { id: replicaId, mm };
}
