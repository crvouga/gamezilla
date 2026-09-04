import { asSeededRng, defineSystem, virtualHost } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { MatchmakingTuning } from '../../interface/matchmaking';
import type { MatchmakingSchema } from '../../interface/schema';
import type { RadiusOptions } from '../../interface/types';
import type { ReplicaBootConfig } from '../boot-replica';
import type { MatchmakingSimBackend } from '../sim-api';
import { buildMatchmakingKit, type MatchmakingSurface } from './facade';
import { startReplica, startStore } from './node-kinds';

/** Typed topology + tuning for one matchmaking script. */
export type MatchmakingArgs = {
  readonly replicas: number;
  readonly backend: MatchmakingSimBackend;
  readonly schema: MatchmakingSchema;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: Partial<MatchmakingTuning>;
};

export const MATCHMAKING_START_MS = 1_700_000_000_000;

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function replicaConfig(args: MatchmakingArgs): ReplicaBootConfig {
  return { schema: args.schema, radius: args.radius, tuning: args.tuning };
}

/** Shared SQL store + N `MatchmakingImplSql` replicas behind one virtual clock. */
export const matchmaking = defineSystem({
  name: 'matchmaking.replicas',
  args: {
    replicas: 1,
    backend: 'sqlite',
    schema: {},
    radius: undefined,
    tuning: {},
  } satisfies MatchmakingArgs,
  draw: () =>
    gen(
      fc.record({
        replicas: fc.integer({ min: 1, max: 3 }),
        backend: fc.constant<MatchmakingSimBackend>('sqlite'),
        schema: fc.constant<MatchmakingSchema>({}),
        radius: fc.constant<RadiusOptions | undefined>(undefined),
        tuning: fc.constant<Partial<MatchmakingTuning>>({}),
      })
    ),
  async create(session, args: MatchmakingArgs): Promise<MatchmakingSurface> {
    const { store } = await startStore(session.fork('store'), args.backend);
    session.onDispose(() => store.close());
    const config = replicaConfig(args);
    const boots = await Promise.all(
      range(args.replicas).map((i) => {
        const id = `r${String(i)}`;
        return startReplica(session.fork(id), store, id, config);
      })
    );
    return buildMatchmakingKit({
      session,
      store,
      boots,
      config,
      rng: asSeededRng(session.ports.rng as never),
    });
  },
});

matchmaking.host({
  default: true,
  name: 'virtual',
  create: () => virtualHost({ startTime: MATCHMAKING_START_MS }),
});

export type { MatchmakingSurface };
