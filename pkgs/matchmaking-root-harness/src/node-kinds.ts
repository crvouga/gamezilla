import { asSeededRng } from '@pkgs/harness-root-shared/rng';
import type { Session } from '@pkgs/harness-root-shared/runtime-types';
import type { MatchmakingHarnessBackend } from './api';
import type { ReplicaBootConfig } from './boot-replica';
import { bootReplicaOnStore } from './boot-replica';
import type { HarnessStore } from './store';
import { openHarnessStore } from './store';

export type MmStore = { readonly store: HarnessStore };

export type MmReplicaBoot = {
  readonly id: string;
  readonly mm: import('@pkgs/matchmaking-root-shared/matchmaking').Matchmaking;
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
