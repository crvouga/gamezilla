import { ACCOUNT_PRIVACY_HARNESS_SLICE } from '@libs/account-privacy-harness-ts/account-privacy-harness-slice';
import { changeAvailableSpace, saveLayoutPreferences } from './device-layout';
import {
  followTrail,
  prepareRecoveryCopy,
  recordTrail,
  recoverApp,
} from './privacy-retention';
/**
 * The full composition: every sub the product ships, folded exactly as
 * production folds them. The product harness and the full-composition
 * suites (`libs/runtime`: shell boot, the platform model, critical journeys)
 * run this; a sub's own spec runs its slice from its own package.
 */

import { BILLING_HARNESS_ACTIONS } from '@libs/billing-harness-ts/billing-actions';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import { CHESS_HARNESS_ACTIONS } from '@libs/chess-puzzle-harness-ts/chess-actions';
import { seedChessPuzzlesForHarness } from '@libs/chess-puzzle-harness-ts/chess-harness-seed';
import { nextPuzzleDifferent } from '@libs/chess-puzzle-harness-ts/chess-properties';
import { FRIENDS_HARNESS_ACTIONS } from '@libs/friends-harness-ts/friends-actions';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import type { HarnessComposition } from '@libs/harness-ts/composition';
import { defineProductSystem } from '@libs/harness-ts/define-product-system';
import { PROFILE_HARNESS_ACTIONS } from '@libs/profile-harness-ts/profile-actions';
import { APP_SUB_CLIENTS } from '@libs/runtime-client-ts/app-sub-clients';
import { APP_AUTH_PROVIDER } from '@libs/runtime-server-ts/app-auth-provider';
import { appSubServers } from '@libs/runtime-server-ts/app-sub-servers';
import { APP } from '@libs/runtime-shared-ts/app-subs';
import { SEARCH_HARNESS_ACTIONS } from '@libs/search-harness-ts/search-actions';
import { searchDoesNotHang } from '@libs/search-harness-ts/search-properties';
import { createInProcessRoomNode } from '@libs/spaces-harness-ts/in-process-room-node';
import { SPACES_HARNESS_ACTIONS } from '@libs/spaces-harness-ts/space-actions';

export const APP_COMPOSITION: HarnessComposition = {
  name: 'app',
  // The auth service exactly as the API Worker builds it.
  authProvider: APP_AUTH_PROVIDER,
  app: APP,
  clients: APP_SUB_CLIENTS,
  servers: (deps) => appSubServers(deps),
  // The production reconciler: the full composition is the one place a
  // harness proves reconcile still lands the real schema.
  migratePostgres: async (args) => {
    const { migrateHarnessPostgres } = await import(
      '@libs/runtime-server-ts/migrate-harness-postgres'
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
