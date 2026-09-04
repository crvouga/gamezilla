import type {
  MatchmakingSchema,
  MatchmakingTuning,
  RadiusOptions,
} from '@pkgs/matchmaking/interface';
import {
  asSeededRng,
  defineRuntime,
  defineSystem,
  virtualTimeRuntime,
} from '@pkgs/sim';
import { gen } from '@pkgs/sim/fast-check';
import fc from 'fast-check';
import type { ReplicaBootConfig } from '../boot-replica';
import type { MatchmakingSimBackend } from '../sim-api';
import { MATCHMAKING_ACTIONS } from './actions';
import { buildMatchmakingSim, type MatchmakingSim } from './facade';
import { startReplica, startStore } from './node-kinds';
import { replicasAgree } from './observations';

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
export const matchmaking = defineSystem<MatchmakingSim, MatchmakingArgs>({
  name: 'matchmaking.replicas',
  args: {
    replicas: 1,
    backend: 'sqlite',
    schema: {},
    radius: undefined,
    tuning: {},
  } satisfies MatchmakingArgs,
  sample: () =>
    gen(
      fc.record({
        replicas: fc.integer({ min: 1, max: 3 }),
        backend: fc.constant<MatchmakingSimBackend>('sqlite'),
        schema: fc.constant<MatchmakingSchema>({}),
        radius: fc.constant<RadiusOptions | undefined>(undefined),
        tuning: fc.constant<Partial<MatchmakingTuning>>({}),
      })
    ),
  async create(session, args: MatchmakingArgs): Promise<MatchmakingSim> {
    const { store } = await startStore(session.fork('store'), args.backend);
    session.onDispose(() => store.close());
    const config = replicaConfig(args);
    const boots = await Promise.all(
      range(args.replicas).map((i) => {
        const id = `r${String(i)}`;
        return startReplica(session.fork(id), store, id, config);
      })
    );
    return buildMatchmakingSim({
      session,
      store,
      boots,
      config,
      rng: asSeededRng(session.ports.rng as never),
    });
  },
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime({ startTime: MATCHMAKING_START_MS }),
    }),
  ],
  actions: [...MATCHMAKING_ACTIONS],
  properties: [replicasAgree],
});

export type { MatchmakingSim };
