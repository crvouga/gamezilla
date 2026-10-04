/**
 * Participant + replica handle builders for the matchmaking harness surface.
 */

import type {
  Matchmaking,
  TickOptions,
} from '@pkgs/matchmaking-shared/matchmaking';
import type { DistanceFormula } from '@pkgs/matchmaking-shared/types';
import type {
  HarnessJoinInput,
  HarnessParticipant,
  HarnessReplica,
} from './api';

export type ReplicaOps = {
  readonly getMm: (replicaId: string) => Matchmaking;
  readonly defaultReplicaId: string;
  readonly createId: () => string;
  readonly owners: Map<string, string>;
};

export function buildHarnessParticipant(
  ops: ReplicaOps,
  participantId: string,
  joinedOn: string,
  ownerId: string
): HarnessParticipant {
  return {
    participantId,
    ownerId,
    joinedOn,
    status: (replicaId) =>
      ops
        .getMm(replicaId ?? ops.defaultReplicaId)
        .status(ownerId, participantId),
    leave: (replicaId) =>
      ops
        .getMm(replicaId ?? ops.defaultReplicaId)
        .leave({ ownerId, participantId, requestId: ops.createId() }),
    updateFormulas: (formulas: readonly DistanceFormula[], replicaId) =>
      ops
        .getMm(replicaId ?? ops.defaultReplicaId)
        .updateFormulas(
          { ownerId, participantId, requestId: ops.createId() },
          formulas
        ),
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
    join: async (input: HarnessJoinInput) => {
      const ownerId = input.ownerId ?? ops.createId();
      const { participantId } = await mm.join({
        ...input,
        ownerId,
        requestId: input.requestId ?? ops.createId(),
      });
      if (participantId === null)
        throw new Error('matchmaking harness: person unavailable');
      ops.owners.set(participantId, ownerId);
      return buildHarnessParticipant(ops, participantId, id, ownerId);
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
  input: HarnessJoinInput,
  replicaId?: string
): Promise<HarnessParticipant> {
  return resolveReplica(deps.replicas, replicaId ?? deps.firstId).join(input);
}
