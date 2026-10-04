/**
 * The composition root's feature set, and the single fold over it.
 *
 * Adding a feature to the product is exactly one edit here: append its
 * manifest. Schema, synced reads, wake topics and writes all derive from this
 * one list — there is no second place that enumerates features, and the same
 * `composeFeatures` runs in production and in every test harness, so the two
 * cannot drift.
 */

import { ACCOUNT_PRIVACY_FEATURE } from '@libs/account-privacy-shared/feature';
import { AUTH_FEATURE } from '@libs/auth-shared/feature';
import { BILLING_FEATURE } from '@libs/billing-shared/feature';
import { CHESS_FEATURE } from '@libs/chess-feature-shared/feature';
import { CLIENT_CONFIG_FEATURE } from '@libs/app-config-shared/feature';
import { composeFeatures } from '@libs/feature-shared/compose';
import type { FeatureManifest } from '@libs/feature-shared/manifest';
import { FRIENDS_FEATURE } from '@libs/friends-shared/feature';
import { NOTIFICATIONS_FEATURE } from '@libs/notifications-shared/feature';
import { PERMISSIONS_FEATURE } from '@libs/permissions-shared/feature';
import { PROFILE_FEATURE } from '@libs/profile-shared/feature';
import { SPACES_FEATURE } from '@libs/spaces-shared/feature';

/** Every bounded context the product ships. */
export const APP_FEATURES: readonly FeatureManifest[] = [
  AUTH_FEATURE,
  ACCOUNT_PRIVACY_FEATURE,
  PROFILE_FEATURE,
  CLIENT_CONFIG_FEATURE,
  SPACES_FEATURE,
  FRIENDS_FEATURE,
  NOTIFICATIONS_FEATURE,
  CHESS_FEATURE,
  BILLING_FEATURE,
  PERMISSIONS_FEATURE,
];

/** The folded app: schema, queries, topic map, mutations. */
export const APP = composeFeatures(APP_FEATURES);
