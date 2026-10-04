import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy-harness/account-privacy-harness-slice';
import { changeAvailableSpace, saveLayoutPreferences } from './device-layout';
import {
  followTrail,
  prepareRecoveryCopy,
  recordTrail,
  recoverApp,
} from './privacy-retention';
/**
 * The full composition: every feature the product ships, folded exactly as
 * production folds them. The product harness and the full-composition
 * suites (`libs/runtime`: shell boot, the platform model, critical journeys)
 * run this; a feature's own spec runs its slice from its own package.
 */

import { BILLING_HARNESS_ACTIONS } from '@libs/billing-harness/billing-actions';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness/chess-properties';
import { FRIENDS_HARNESS_ACTIONS } from '@libs/friends-harness/friends-actions';
import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import type { HarnessComposition } from '@libs/harness/composition';
import { defineProductSystem } from '@libs/harness/define-product-system';
import { PROFILE_HARNESS_ACTIONS } from '@libs/profile-harness/profile-actions';
import { APP_FEATURE_CLIENTS } from '@libs/runtime-client/app-feature-clients';
import { appFeatureServers } from '@libs/runtime-server/app-feature-servers';
import { APP } from '@libs/runtime-shared/app-features';
import { SEARCH_HARNESS_ACTIONS } from '@libs/search-harness/search-actions';
import { searchDoesNotHang } from '@libs/search-harness/search-properties';
import { createInProcessRoomNode } from '@libs/spaces-harness/in-process-room-node';
import { SPACES_HARNESS_ACTIONS } from '@libs/spaces-harness/space-actions';

export const APP_COMPOSITION: HarnessComposition = {
  name: 'app',
  app: APP,
  clients: APP_FEATURE_CLIENTS,
  servers: (deps) => appFeatureServers(deps),
  // The production reconciler: the full composition is the one place a
  // harness proves reconcile still lands the real schema.
  migratePostgres: async (args) => {
    const { migrateHarnessPostgres } = await import(
      '@libs/runtime-server/migrate-harness-postgres'
    );
    await migrateHarnessPostgres(args);
  },
  migrateFingerprint: 'libs/runtime reconcilePostgres',
  roomNode: (env, gateway) =>
    createInProcessRoomNode(env, { games: GAME_DEFINITIONS, gateway }),
  seedServer: seedChessPuzzlesForHarness,
  billingOffer: PLUS_MEMBERSHIP_OFFER,
  properties: [searchDoesNotHang, nextPuzzleDifferent],
  actions: [
    prepareRecoveryCopy,
    recoverApp,
    recordTrail,
    followTrail,
    changeAvailableSpace,
    saveLayoutPreferences,
    ...(ACCOUNT_PRIVACY_HARNESS_SLICE.actions ?? []),
    ...SPACES_HARNESS_ACTIONS,
    ...CHESS_HARNESS_ACTIONS,
    ...PROFILE_HARNESS_ACTIONS,
    ...SEARCH_HARNESS_ACTIONS,
    ...FRIENDS_HARNESS_ACTIONS,
    ...BILLING_HARNESS_ACTIONS,
  ],
};

/**
 * The product system over the full composition. The product harness and
 * the whole-app suites run it; `in-process` by default, `bun-webview` for a
 * live browser (`HARNESS_MODE=real|stack`).
 */
export const APP_SYSTEM = defineProductSystem(APP_COMPOSITION);
