/**
 * Participant + replica handle builders for the matchmaking sim world.
 */

import type { Matchmaking, TickOptions } from '../interface/matchmaking';
import type { DistanceFormula, JoinInput } from '../interface/types';
import type { ParticipantHandle, ReplicaHandle } from './world-api';

export type WorldReplicaOps = {
  readonly getMm: (replicaId: string) => Matchmaking;
  readonly defaultReplicaId: string;
};

export function buildParticipantHandle(
  ops: WorldReplicaOps,
  participantId: string,
  joinedOn: string
): ParticipantHandle {
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

export function buildReplicaHandle(
  ops: WorldReplicaOps,
  id: string,
  mm: Matchmaking
): ReplicaHandle {
  return {
    id,
    mm,
    join: async (input: JoinInput) => {
      const { participantId } = await mm.join(input);
      return buildParticipantHandle(ops, participantId, id);
    },
    tick: (opts?: TickOptions) => mm.tick(opts),
  };
}

export type WorldFacadeDeps = {
  readonly replicas: Map<string, ReplicaHandle>;
  readonly ops: WorldReplicaOps;
  readonly firstId: string;
};

export function resolveReplica(
  replicas: ReadonlyMap<string, ReplicaHandle>,
  id: string
): ReplicaHandle {
  const r = replicas.get(id);
  if (r === undefined) {
    throw new Error(`MatchmakingSimWorld: unknown replica ${id}`);
  }
  return r;
}

/** Narrow helper so world.ts stays under the function size cap. */
export async function joinOnWorld(
  deps: WorldFacadeDeps,
  input: JoinInput,
  replicaId?: string
): Promise<ParticipantHandle> {
  return resolveReplica(deps.replicas, replicaId ?? deps.firstId).join(input);
}
