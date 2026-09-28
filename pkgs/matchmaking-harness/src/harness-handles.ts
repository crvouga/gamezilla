/**
 * Participant + replica handle builders for the matchmaking harness surface.
 */

import type {
  DistanceFormula,
  JoinInput,
  Matchmaking,
  TickOptions,
} from '@pkgs/matchmaking/interface';
import type { HarnessParticipant, HarnessReplica } from './harness-api';

export type ReplicaOps = {
  readonly getMm: (replicaId: string) => Matchmaking;
  readonly defaultReplicaId: string;
};

export function buildHarnessParticipant(
  ops: ReplicaOps,
  participantId: string,
  joinedOn: string
): HarnessParticipant {
  return {
    participantId,
    joinedOn,
    status: (replicaId) =>
      ops.getMm(replicaId ?? ops.defaultReplicaId).status(participantId),
    leave: (replicaId) =>
      ops.getMm(replicaId ?? ops.defaultReplicaId).leave(participantId),
    updateFormulas: (formulas: readonly DistanceFormula[], replicaId) =>
      ops
        .getMm(replicaId ?? ops.defaultReplicaId)
        .updateFormulas(participantId, formulas),
  };
}

export function buildHarnessReplica(
  ops: ReplicaOps,
  id: string,
  mm: Matchmaking
): HarnessReplica {
  return {
    id,
    mm,
    join: async (input: JoinInput) => {
      const { participantId } = await mm.join(input);
      return buildHarnessParticipant(ops, participantId, id);
    },
    tick: (opts?: TickOptions) => mm.tick(opts),
  };
}

export type FacadeDeps = {
  readonly replicas: Map<string, HarnessReplica>;
  readonly ops: ReplicaOps;
  readonly firstId: string;
};

export function resolveReplica(
  replicas: ReadonlyMap<string, HarnessReplica>,
  id: string
): HarnessReplica {
  const r = replicas.get(id);
  if (r === undefined) {
    throw new Error(`matchmaking harness: unknown replica ${id}`);
  }
  return r;
}

/** Narrow helper so `facade.ts` stays under the function size cap. */
export async function joinOnReplica(
  deps: FacadeDeps,
  input: JoinInput,
  replicaId?: string
): Promise<HarnessParticipant> {
  return resolveReplica(deps.replicas, replicaId ?? deps.firstId).join(input);
}
