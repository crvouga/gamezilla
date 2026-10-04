import { defineRuntime } from '@pkgs/harness-root-shared/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared/define-system';
import { gen } from '@pkgs/harness-root-shared/fast-check';
import { asSeededRng } from '@pkgs/harness-root-shared/rng';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared/virtual-time-runtime';
import type { MatchmakingTuning } from '@pkgs/matchmaking-root-shared/matchmaking';
import type { MatchmakingSchema } from '@pkgs/matchmaking-root-shared/schema';
import type { RadiusOptions } from '@pkgs/matchmaking-root-shared/types';
import fc from 'fast-check';
import { MATCHMAKING_ACTIONS } from './actions';
import type { MatchmakingHarnessBackend } from './api';
import { exampleAppSchema } from './attrs';
import type { ReplicaBootConfig } from './boot-replica';
import type { MatchmakingHarness } from './facade';
import { buildMatchmakingHarness } from './facade';
import { startReplica, startStore } from './node-kinds';
import { replicasAgree } from './observations';

/** Typed topology + tuning for one matchmaking script. */
export type MatchmakingArgs = {
  readonly replicas: number;
  readonly backend: MatchmakingHarnessBackend;
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
export const matchmaking = defineSystem<MatchmakingHarness, MatchmakingArgs>({
  name: 'matchmaking.replicas',
  args: {
    replicas: 1,
    backend: 'sqlite',
    schema: exampleAppSchema(),
    radius: undefined,
    tuning: {},
  } satisfies MatchmakingArgs,
  sample: () =>
    gen(
      fc.record({
        replicas: fc.integer({ min: 1, max: 3 }),
        backend: fc.constant<MatchmakingHarnessBackend>('sqlite'),
        schema: fc.constant<MatchmakingSchema>(exampleAppSchema()),
        radius: fc.constant<RadiusOptions | undefined>(undefined),
        tuning: fc.constant<Partial<MatchmakingTuning>>({}),
      })
    ),
  async create(session, args: MatchmakingArgs): Promise<MatchmakingHarness> {
    const { store } = await startStore(session.fork('store'), args.backend);
    session.onDispose(() => store.close());
    const config = replicaConfig(args);
    const boots = await Promise.all(
      range(args.replicas).map((i) => {
        const id = `r${String(i)}`;
        return startReplica(session.fork(id), store, id, config);
      })
    );
    return buildMatchmakingHarness({
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
