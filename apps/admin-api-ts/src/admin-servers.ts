import { createChessAdminServer } from '@libs/chess-root-server-ts/admin-server';
import { createObservatoryAdminServer } from '@libs/observatory-server-ts/admin-server';
import { composeSubServers } from '@libs/sub-shared-ts/compose-server';
import { SYNTHETIC_POPULATION_ADMIN_SERVER } from '@libs/synthetic-population-server-ts/admin-server';
import { syntheticPopulationForObservatory } from '@libs/synthetic-population-server-ts/observatory-port';

export const adminServers = composeSubServers([
  createObservatoryAdminServer(syntheticPopulationForObservatory),
  SYNTHETIC_POPULATION_ADMIN_SERVER,
  createChessAdminServer(),
]);
