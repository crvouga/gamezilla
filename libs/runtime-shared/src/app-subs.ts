/**
 * The composition root's sub list, and the single fold over it.
 *
 * Adding a sub to the product is exactly one edit here: append its
 * manifest. Schema, synced reads, wake topics and writes all derive from this
 * one list — there is no second place that enumerates subs, and the same
 * `composeSubs` runs in production and in every test harness, so the two
 * cannot drift. The shipped list is depth-1; a sub may still contain subs.
 */

import { ACCOUNT_PRIVACY_SUB } from '@libs/account-privacy-shared/sub';
import { CLIENT_CONFIG_SUB } from '@libs/app-config-shared/sub';
import { AUTH_SUB } from '@libs/auth-shared/sub';
import { BILLING_SUB } from '@libs/billing-shared/sub';
import { CHESS_SUB } from '@libs/chess-sub-shared/sub';
import { FRIENDS_SUB } from '@libs/friends-shared/sub';
import { NOTIFICATIONS_SUB } from '@libs/notifications-shared/sub';
import { PERMISSIONS_SUB } from '@libs/permissions-shared/sub';
import { PROFILE_SUB } from '@libs/profile-shared/sub';
import { SPACES_SUB } from '@libs/spaces-shared/sub';
import { composeSubs } from '@libs/sub-shared/compose';
import type { SubManifest } from '@libs/sub-shared/manifest';
import { SYNTHETIC_POPULATION_SUB } from '@libs/synthetic-population-shared/sub';

/** Every bounded context the product ships. */
export const APP_SUBS: readonly SubManifest[] = [
  AUTH_SUB,
  ACCOUNT_PRIVACY_SUB,
  PROFILE_SUB,
  CLIENT_CONFIG_SUB,
  SPACES_SUB,
  FRIENDS_SUB,
  NOTIFICATIONS_SUB,
  CHESS_SUB,
  BILLING_SUB,
  PERMISSIONS_SUB,
  SYNTHETIC_POPULATION_SUB,
];

/** The folded app: schema, queries, topic map, mutations. */
export const APP = composeSubs(APP_SUBS);
