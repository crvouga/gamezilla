/**
 * Build MatchmakingImplSql replicas sharing one store + sim clock.
 */

import type { SimIo } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { MatchmakingImplSql } from '../impl-sql';
import type { Matchmaking, MatchmakingTuning } from '../interface/matchmaking';
import type { MatchmakingSchema } from '../interface/schema';
import type { RadiusOptions } from '../interface/types';
import { createSeededCreateId } from './create-id';
import type { SimStore } from './store';

export type ReplicaBootConfig = {
  readonly schema: MatchmakingSchema;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: Partial<MatchmakingTuning>;
};

function tuningFromPartial(
  partial: Partial<MatchmakingTuning>,
  now: () => number,
  createId: () => string
): MatchmakingTuning {
  return {
    ...(partial.maxPairsPerPass !== undefined
      ? { maxPairsPerPass: partial.maxPairsPerPass }
      : {}),
    ...(partial.maxWaitSeconds !== undefined
      ? { maxWaitSeconds: partial.maxWaitSeconds }
      : {}),
    ...(partial.matchedRetentionSeconds !== undefined
      ? { matchedRetentionSeconds: partial.matchedRetentionSeconds }
      : {}),
    now,
    createId,
  };
}

export function buildReplicaMatchmaking(args: {
  readonly sqlClient: SqlClient;
  readonly io: SimIo;
  readonly replicaId: string;
  readonly config: ReplicaBootConfig;
}): Matchmaking {
  const createId = createSeededCreateId(
    args.io.rng.fork(`replica:${args.replicaId}`).random
  );
  return new MatchmakingImplSql({
    sqlClient: args.sqlClient,
    schema: args.config.schema,
    ...(args.config.radius !== undefined ? { radius: args.config.radius } : {}),
    tuning: tuningFromPartial(
      args.config.tuning,
      () => args.io.clock.now(),
      createId
    ),
  });
}

export async function bootReplicaOnStore(args: {
  readonly store: SimStore;
  readonly io: SimIo;
  readonly replicaId: string;
  readonly config: ReplicaBootConfig;
}): Promise<Matchmaking> {
  const mm = buildReplicaMatchmaking({
    sqlClient: args.store.openClient(),
    io: args.io,
    replicaId: args.replicaId,
    config: args.config,
  });
  await mm.ready();
  return mm;
}
