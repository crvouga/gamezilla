/**
 * Build MatchmakingImplSql replicas sharing one store + harness clock.
 */

import type {
  Matchmaking,
  MatchmakingTuning,
} from '@pkgs/matchmaking-root-shared/matchmaking';
import type { MatchmakingSchema } from '@pkgs/matchmaking-root-shared/schema';
import type { RadiusOptions } from '@pkgs/matchmaking-root-shared/types';
import { MatchmakingImplSql } from '@pkgs/matchmaking-sql-server/matchmaking';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { SeededRng } from '@pkgs/uuid-shared/seeded-rng';
import { createSeededCreateId } from './create-id';
import type { HarnessStore } from './store';

/** Minimal clock — works with `@pkgs/harness-root-shared` and `@pkgs/clock` HarnessClock. */
export type ReplicaClock = {
  readonly now: () => number;
};

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
    now,
    createId,
  };
}

export function buildReplicaMatchmaking(args: {
  readonly sqlClient: SqlClient;
  readonly clock: ReplicaClock;
  readonly rng: SeededRng;
  readonly replicaId: string;
  readonly config: ReplicaBootConfig;
}): Matchmaking {
  const createId = createSeededCreateId(
    args.rng.fork(`replica:${args.replicaId}`).random
  );
  return new MatchmakingImplSql({
    sqlClient: args.sqlClient,
    schema: args.config.schema,
    ...(args.config.radius !== undefined ? { radius: args.config.radius } : {}),
    tuning: tuningFromPartial(
      args.config.tuning,
      () => args.clock.now(),
      createId
    ),
  });
}

export async function bootReplicaOnStore(args: {
  readonly store: HarnessStore;
  readonly clock: ReplicaClock;
  readonly rng: SeededRng;
  readonly replicaId: string;
  readonly config: ReplicaBootConfig;
}): Promise<Matchmaking> {
  const mm = buildReplicaMatchmaking({
    sqlClient: args.store.openClient(),
    clock: args.clock,
    rng: args.rng,
    replicaId: args.replicaId,
    config: args.config,
  });
  await mm.ready();
  return mm;
}
