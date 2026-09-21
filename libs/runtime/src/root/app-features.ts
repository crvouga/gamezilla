/**
 * The composition root's feature set, and the single fold over it.
 *
 * Adding a feature to the product is exactly one edit here: append its
 * manifest. Schema, synced reads, wake topics and writes all derive from this
 * one list — there is no second place that enumerates features, and the same
 * `composeFeatures` runs in production and in every test harness, so the two
 * cannot drift.
 */

import { AUTH_FEATURE } from '@libs/auth/root/feature';
import { BILLING_FEATURE } from '@libs/billing/root/feature';
import { CHESS_FEATURE } from '@libs/chess/root/feature';
import { CLIENT_CONFIG_FEATURE } from '@libs/client-config/root/feature';
import { composeFeatures } from '@libs/feature/public/compose';
import type { FeatureManifest } from '@libs/feature/public/manifest';
import { FRIENDS_FEATURE } from '@libs/friends/root/feature';
import { NOTIFICATIONS_FEATURE } from '@libs/notifications/root/feature';
import { PERMISSIONS_FEATURE } from '@libs/permissions/root/feature';
import { PROFILE_FEATURE } from '@libs/profile/root/feature';
import { SPACES_FEATURE } from '@libs/spaces/root/feature';

/** Every bounded context the product ships. */
export const APP_FEATURES: readonly FeatureManifest[] = [
  AUTH_FEATURE,
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
