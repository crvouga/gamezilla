import { AUTH_QUERIES } from '@libs/auth/root/queries';
import { BILLING_QUERIES } from '@libs/billing/root/queries';
import { CHESS_QUERIES } from '@libs/chess/root/queries';
import { CLIENT_CONFIG_QUERIES } from '@libs/client-config/root/queries';
import { FRIENDS_QUERIES } from '@libs/friends/root/queries';
import { NOTIFICATIONS_QUERIES } from '@libs/notifications/root/queries';
import { PROFILE_QUERIES } from '@libs/profile/root/queries';
import { SPACE_QUERIES } from '@libs/spaces/root/queries';
import { queryRegistry } from '@pkgs/sync-engine/shared';

/** Product query registry — shared by API, client, and index workload extract. */
export const APP_QUERIES = queryRegistry([
  ...AUTH_QUERIES,
  ...PROFILE_QUERIES,
  ...SPACE_QUERIES,
  ...FRIENDS_QUERIES,
  ...CHESS_QUERIES,
  ...CLIENT_CONFIG_QUERIES,
  ...NOTIFICATIONS_QUERIES,
  ...BILLING_QUERIES,
]);
