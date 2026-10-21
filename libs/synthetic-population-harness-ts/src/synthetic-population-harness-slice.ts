import type { HarnessSlice } from '@libs/harness-ts/slices';
import { SYNTHETIC_POPULATION_CLIENT } from '@libs/synthetic-population-client-ts/sub-client';
import { syntheticPopulationSignInMail } from '@libs/synthetic-population-server-ts/sign-in-inbox';
import { SYNTHETIC_POPULATION_SERVER } from '@libs/synthetic-population-server-ts/sub-server';
import { SYNTHETIC_POPULATION_SUB } from '@libs/synthetic-population-shared-ts/sub';

export const SYNTHETIC_POPULATION_HARNESS_SLICE: HarnessSlice = {
  name: 'synthetic-population',
  sub: SYNTHETIC_POPULATION_SUB,
  client: SYNTHETIC_POPULATION_CLIENT,
  server: () => SYNTHETIC_POPULATION_SERVER,
  // As deployed: sign-in mail for Synthetic Users stays in the internal inbox.
  emailLinks: (env) =>
    syntheticPopulationSignInMail({
      getDb: env.getSql,
      ports: { clock: env.clock, createId: env.createId },
    }),
};
