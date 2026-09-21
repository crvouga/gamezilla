/**
 * The full composition: every feature the product ships, folded exactly as
 * production folds them. The product simulator and the full-composition
 * suites (cross-feature journeys, smoke, walks) run this; a feature's own e2e
 * runs its slice from its own package.
 */

import { BILLING_SIM_ACTIONS } from '@libs/billing/sim/billing-actions';
import { billingBrowserPage } from '@libs/billing/sim/billing-browser-page';
import { CHESS_SIM_ACTIONS } from '@libs/chess/sim/chess-actions';
import { nextPuzzleDifferent } from '@libs/chess/sim/chess-properties';
import { seedChessPuzzlesForSim } from '@libs/chess/sim/chess-sim-seed';
import { FRIENDS_SIM_ACTIONS } from '@libs/friends/sim/friends-actions';
import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { PROFILE_SIM_ACTIONS } from '@libs/profile/sim/profile-actions';
import { APP } from '@libs/runtime/root/app-features';
import { APP_FEATURE_CLIENTS } from '@libs/runtime/root/client/app-feature-clients';
import { appFeatureServers } from '@libs/runtime/root/server/app-feature-servers';
import { SEARCH_SIM_ACTIONS } from '@libs/search/sim/search-actions';
import { searchDoesNotHang } from '@libs/search/sim/search-properties';
import type { SimComposition } from '@libs/sim-harness/composition';
import { createInProcessRoomNode } from '@libs/spaces/sim/in-process-room-node';
import { SPACES_SIM_ACTIONS } from '@libs/spaces/sim/space-actions';

export const APP_COMPOSITION: SimComposition = {
  name: 'app',
  app: APP,
  clients: APP_FEATURE_CLIENTS,
  servers: (deps) => appFeatureServers(deps),
  // The production runner, cutovers included: the full composition is the
  // one place a sim proves the real migrate still lands the real schema.
  migratePostgres: async (args) => {
    const { migrateSimPostgres } = await import(
      '@libs/runtime/root/sim/migrate-sim-postgres'
    );
    await migrateSimPostgres(args);
  },
  migrateFingerprint: 'libs/runtime PostgresMigrationRunner',
  roomNode: (env) => createInProcessRoomNode(env, GAME_DEFINITIONS),
  seedServer: seedChessPuzzlesForSim,
  browserPages: [billingBrowserPage],
  properties: [searchDoesNotHang, nextPuzzleDifferent],
  actions: [
    ...SPACES_SIM_ACTIONS,
    ...CHESS_SIM_ACTIONS,
    ...PROFILE_SIM_ACTIONS,
    ...SEARCH_SIM_ACTIONS,
    ...FRIENDS_SIM_ACTIONS,
    ...BILLING_SIM_ACTIONS,
  ],
};
