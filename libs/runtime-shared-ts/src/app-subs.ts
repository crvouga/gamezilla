import { TURN_GAMES } from '@libs/game-catalog-shared-ts/turn-games';
import { gamePuzzleSubs } from '@libs/game-puzzle-shared-ts/sub';
import { createGameSessionSub } from '@libs/game-session-shared-ts/sub';
/**
 * The composition root's sub list, and the single fold over it.
 *
 * Adding a sub to the product is exactly one edit here: append its
 * manifest. Schema, synced reads, wake topics and writes all derive from this
 * one list — there is no second place that enumerates subs, and the same
 * `composeSubs` runs in production and in every test harness, so the two
 * cannot drift. The shipped list is depth-1; a sub may still contain subs.
 */

import { ACCOUNT_PRIVACY_SUB } from '@libs/account-privacy-shared-ts/sub';
import { CLIENT_CONFIG_SUB } from '@libs/app-config-shared-ts/sub';
import { AUTH_SUB } from '@libs/auth-shared-ts/sub';
import { BILLING_SUB } from '@libs/billing-shared-ts/sub';
import { CHESS_SUB } from '@libs/chess-sub-shared-ts/sub';
import { FRIENDS_SUB } from '@libs/friends-shared-ts/sub';
import { NOTIFICATIONS_SUB } from '@libs/notifications-shared-ts/sub';
import { PERMISSIONS_SUB } from '@libs/permissions-shared-ts/sub';
import { PROFILE_SUB } from '@libs/profile-shared-ts/sub';
import { SPACES_SUB } from '@libs/spaces-shared-ts/sub';
import { composeSubs } from '@libs/sub-shared-ts/compose';
import type { SubManifest } from '@libs/sub-shared-ts/manifest';
import { SYNTHETIC_POPULATION_SUB } from '@libs/synthetic-population-shared-ts/sub';

/** Every bounded context the product ships. */
export const APP_SUBS: readonly SubManifest[] = [
  AUTH_SUB,
  ACCOUNT_PRIVACY_SUB,
  PROFILE_SUB,
  CLIENT_CONFIG_SUB,
  SPACES_SUB,
  FRIENDS_SUB,
  NOTIFICATIONS_SUB,
  ...gamePuzzleSubs(TURN_GAMES),
  CHESS_SUB,
  createGameSessionSub(TURN_GAMES.games),
  BILLING_SUB,
  PERMISSIONS_SUB,
  SYNTHETIC_POPULATION_SUB,
];

/** The folded app: schema, queries, topic map, mutations. */
export const APP = composeSubs(APP_SUBS);
