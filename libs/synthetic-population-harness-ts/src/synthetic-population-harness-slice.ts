import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { runScopedCreateId } from '@libs/harness-ts/run-scope';
import type { HarnessSlice } from '@libs/harness-ts/slices';
import { createSyntheticPopulationClient } from '@libs/synthetic-population-client-ts/sub-client';
import { SYNTHETIC_POPULATION_ADMIN_SERVER } from '@libs/synthetic-population-server-ts/admin-server';
import { syntheticPopulationSignInMail } from '@libs/synthetic-population-server-ts/sign-in-inbox';
import { SYNTHETIC_POPULATION_SERVER } from '@libs/synthetic-population-server-ts/sub-server';
import { SYNTHETIC_POPULATION_SUB } from '@libs/synthetic-population-shared-ts/sub';
import { retireEarlierPopulation } from './population-baseline';
import { workerNow } from './worker-clock';

export const SYNTHETIC_POPULATION_HARNESS_SLICE: HarnessSlice = {
  name: 'synthetic-population',
  sub: SYNTHETIC_POPULATION_SUB,
  client: createSyntheticPopulationClient({
    loadGames: async () => HARNESS_GAMES.map((game) => game.client),
  }),
  server: () => ({
    ...SYNTHETIC_POPULATION_SERVER,
    subs: [
      {
        ...SYNTHETIC_POPULATION_ADMIN_SERVER,
        routes: (ctx) =>
          SYNTHETIC_POPULATION_ADMIN_SERVER.routes!({
            ...ctx,
            clock: { now: () => workerNow(ctx.clock) },
          }),
      },
    ],
    routes: (ctx) =>
      SYNTHETIC_POPULATION_SERVER.routes!({
        ...ctx,
        clock: { now: () => workerNow(ctx.clock) },
      }),
  }),
  // A scenario sees exactly the Synthetic Population it builds, also on a
  // stack an earlier scenario already populated.
  beforeScenario: (s) =>
    retireEarlierPopulation(s.harness.serverSql.sqlClient, {
      clock: s.harness.clock,
      createId: runScopedCreateId(s),
      notify: async () => undefined,
    }),
  // As deployed: sign-in mail for Synthetic Users stays in the internal inbox.
  emailLinks: (env) =>
    syntheticPopulationSignInMail({
      getDb: env.getSql,
      ports: { clock: env.clock, createId: env.createId },
    }),
};
